'use strict';

// Mock the db module before requiring the app
jest.mock('../db');

const request = require('supertest');
const app = require('../index');
const { breaker } = require('../db');

// Helper to build a fake DB row
function makeRow(overrides = {}) {
  return {
    id: 'prod-uuid-1',
    name: 'Widget A',
    description: 'A great widget',
    price: '19.99',
    category: 'widgets',
    stock_quantity: 5,
    image_key: 'images/widget-a.jpg',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: breaker is closed (healthy)
  breaker.opened = false;
});

describe('GET /products', () => {
  it('returns 200 with a products array', async () => {
    breaker.fire.mockResolvedValue({ rows: [makeRow()] });

    const res = await request(app).get('/products');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products).toHaveLength(1);
  });

  it('includes required fields on each product', async () => {
    breaker.fire.mockResolvedValue({ rows: [makeRow()] });

    const res = await request(app).get('/products');
    const product = res.body.products[0];

    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('description');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('in_stock');
    expect(product).toHaveProperty('category');
    expect(product).toHaveProperty('imageUrl');
  });
});

describe('GET /products/search', () => {
  it('returns matching products for a query', async () => {
    const row = makeRow({ name: 'Blue Sneaker' });
    breaker.fire.mockResolvedValue({ rows: [row] });

    const res = await request(app).get('/products/search?q=sneaker');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Blue Sneaker');
  });

  it('returns empty array for blank query', async () => {
    const res = await request(app).get('/products/search?q=');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });
});

describe('GET /products/category/:cat', () => {
  it('returns products filtered by category', async () => {
    const row = makeRow({ category: 'shoes' });
    breaker.fire.mockResolvedValue({ rows: [row] });

    const res = await request(app).get('/products/category/shoes');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].category).toBe('shoes');
  });

  it('returns empty array when no products in category', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/products/category/nonexistent');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });
});

describe('GET /products/:id', () => {
  it('returns 404 for an unknown product id', async () => {
    breaker.fire.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/products/unknown-id');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the product when found', async () => {
    const row = makeRow({ id: 'known-id' });
    breaker.fire.mockResolvedValue({ rows: [row] });

    const res = await request(app).get('/products/known-id');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('known-id');
  });
});

describe('Circuit breaker / DB unavailable', () => {
  it('returns 503 when the circuit breaker is open', async () => {
    breaker.opened = true;
    const err = new Error('Service temporarily unavailable');
    err.status = 503;
    breaker.fire.mockRejectedValue(err);

    const res = await request(app).get('/products');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 503 on search when circuit breaker is open', async () => {
    breaker.opened = true;
    const err = new Error('Service temporarily unavailable');
    err.status = 503;
    breaker.fire.mockRejectedValue(err);

    const res = await request(app).get('/products/search?q=test');

    expect(res.status).toBe(503);
  });
});

describe('Stock status (in_stock field)', () => {
  it('sets in_stock to false when stock_quantity is 0', async () => {
    breaker.fire.mockResolvedValue({ rows: [makeRow({ stock_quantity: 0 })] });

    const res = await request(app).get('/products');

    expect(res.body.products[0].in_stock).toBe(false);
  });

  it('sets in_stock to true when stock_quantity is greater than 0', async () => {
    breaker.fire.mockResolvedValue({ rows: [makeRow({ stock_quantity: 3 })] });

    const res = await request(app).get('/products');

    expect(res.body.products[0].in_stock).toBe(true);
  });
});

describe('Image URL uses CLOUDFRONT_DOMAIN prefix', () => {
  const originalEnv = process.env.CLOUDFRONT_DOMAIN;

  beforeAll(() => {
    process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';
  });

  afterAll(() => {
    process.env.CLOUDFRONT_DOMAIN = originalEnv;
  });

  it('constructs imageUrl with the CloudFront domain', async () => {
    // Re-require the route module so it picks up the env var
    jest.resetModules();
    jest.mock('../db');
    process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';

    const freshApp = require('../index');
    const { breaker: freshBreaker } = require('../db');
    freshBreaker.opened = false;
    freshBreaker.fire.mockResolvedValue({ rows: [makeRow({ image_key: 'images/widget.jpg' })] });

    const res = await request(freshApp).get('/products');

    expect(res.body.products[0].imageUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
  });
});

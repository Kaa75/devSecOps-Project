'use strict';

const { Router } = require('express');
const { breaker } = require('../db');

const router = Router();

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    in_stock: row.stock_quantity > 0,
    category: row.category,
    imageUrl: row.image_key ? `https://${CLOUDFRONT_DOMAIN}/${row.image_key}` : null,
    stock_quantity: row.stock_quantity,
    created_at: row.created_at,
  };
}

function handleDbError(err, res) {
  if (err.status === 503 || breaker.opened) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

// GET /products — paginated, active only
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const result = await breaker.fire(
      'SELECT id, name, description, price, category, stock_quantity, image_key, created_at FROM products WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json({ page, limit, products: result.rows.map(formatProduct) });
  } catch (err) {
    return handleDbError(err, res);
  }
});

// GET /products/search?q=<query> — full-text search, active only
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ products: [] });
  }

  try {
    const result = await breaker.fire(
      `SELECT id, name, description, price, category, stock_quantity, image_key, created_at
       FROM products
       WHERE is_active = TRUE
         AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)
       ORDER BY created_at DESC`,
      [q]
    );
    return res.json({ products: result.rows.map(formatProduct) });
  } catch (err) {
    return handleDbError(err, res);
  }
});

// GET /products/category/:cat — filter by category, active only
router.get('/category/:cat', async (req, res) => {
  const { cat } = req.params;

  try {
    const result = await breaker.fire(
      'SELECT id, name, description, price, category, stock_quantity, image_key, created_at FROM products WHERE is_active = TRUE AND category = $1 ORDER BY created_at DESC',
      [cat]
    );
    return res.json({ products: result.rows.map(formatProduct) });
  } catch (err) {
    return handleDbError(err, res);
  }
});

// GET /products/:id — single product, active only
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await breaker.fire(
      'SELECT id, name, description, price, category, stock_quantity, image_key, created_at FROM products WHERE id = $1 AND is_active = TRUE',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json(formatProduct(result.rows[0]));
  } catch (err) {
    return handleDbError(err, res);
  }
});

module.exports = router;

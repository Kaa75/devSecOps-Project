'use strict';

const express = require('express');
const { breaker } = require('../db');
const { requireAdminAuth } = require('../middleware/jwt');

const router = express.Router();

// Apply admin auth to all routes in this router
router.use(requireAdminAuth);

/**
 * GET /admin/products
 * List all products including inactive ones (Admin JWT required)
 */
router.get('/admin/products', async (req, res) => {
  try {
    const result = await breaker.fire(
      `SELECT id, name, description, price, category, stock_quantity, image_key, is_active, created_at, updated_at
       FROM products
       ORDER BY created_at DESC`,
      []
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List products error:', err.message);
    if (err.status === 503) return res.status(503).json({ error: 'Service temporarily unavailable' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/orders
 * List all orders across all customers (Admin JWT required)
 */
router.get('/admin/orders', async (req, res) => {
  try {
    const result = await breaker.fire(
      `SELECT o.id, o.customer_email, o.status, o.total_amount, o.created_at,
              COALESCE(json_agg(json_build_object(
                'product_id', oi.product_id,
                'product_name', p.name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price
              ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 200`,
      []
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List orders error:', err.message);
    if (err.status === 503) return res.status(503).json({ error: 'Service temporarily unavailable' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/products
 * Create a new product (Admin JWT required)
 */
router.post('/admin/products', async (req, res) => {
  const { name, description, price, category, stock_quantity, image_key } = req.body;

  if (!name || price === undefined || !category) {
    return res.status(400).json({ error: 'name, price, and category are required' });
  }

  try {
    const result = await breaker.fire(
      `INSERT INTO products (name, description, price, category, stock_quantity, image_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, price, category, stock_quantity, image_key, is_active, created_at, updated_at`,
      [name, description || null, price, category, stock_quantity ?? 0, image_key || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /admin/products/:id
 * Update a product's details (Admin JWT required)
 */
router.put('/admin/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category } = req.body;

  try {
    const result = await breaker.fire(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           category = COALESCE($4, category),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, description, price, category, stock_quantity, image_key, is_active, created_at, updated_at`,
      [name || null, description !== undefined ? description : null, price || null, category || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /admin/products/:id/stock
 * Adjust stock quantity (Admin JWT required)
 */
router.patch('/admin/products/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { stock_quantity } = req.body;

  if (stock_quantity === undefined || typeof stock_quantity !== 'number') {
    return res.status(400).json({ error: 'stock_quantity (number) is required' });
  }

  try {
    const result = await breaker.fire(
      `UPDATE products
       SET stock_quantity = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, stock_quantity`,
      [stock_quantity, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update stock error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/products/:id/deactivate
 * Deactivate a product (Admin JWT required)
 */
router.post('/admin/products/:id/deactivate', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await breaker.fire(
      `UPDATE products
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Deactivate product error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/products/:id/activate
 * Re-activate a deactivated product (Admin JWT required)
 */
router.post('/admin/products/:id/activate', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await breaker.fire(
      `UPDATE products SET is_active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, is_active`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Activate product error:', err.message);
    if (err.status === 503) return res.status(503).json({ error: 'Service temporarily unavailable' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/returns
 * Process a return — increments stock by the returned quantity (Admin JWT required)
 */
router.post('/admin/returns', async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({ error: 'productId and positive quantity are required' });
  }

  try {
    const result = await breaker.fire(
      `UPDATE products
       SET stock_quantity = stock_quantity + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, stock_quantity`,
      [quantity, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json({
      productId: result.rows[0].id,
      stock_quantity: result.rows[0].stock_quantity,
    });
  } catch (err) {
    console.error('Process return error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

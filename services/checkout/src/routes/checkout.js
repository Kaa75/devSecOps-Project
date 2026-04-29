'use strict';

const express = require('express');
const { withTransaction, pool } = require('../db');
const redis = require('../redis');
const { publishOrderEvent } = require('../sqs');
const { requireCustomerAuth } = require('../middleware/jwt');

const router = express.Router();

/**
 * POST /checkout
 * Initiate checkout (requires Customer JWT)
 * 
 * 5-step distributed transaction:
 * 1. Validate — verify all cart items have sufficient stock
 * 2. Reserve + Record — within a single DB transaction: decrement stock, insert order, insert order_items
 * 3. Publish — send order event to SQS queue
 * 4. Clear — delete cart from Redis (best-effort)
 */
router.post('/checkout', requireCustomerAuth, async (req, res) => {
  const { items } = req.body;
  const customerId = req.user.sub;
  const customerEmail = req.user.email || '';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty items array' });
  }

  // Validate items structure
  for (const item of items) {
    if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
      return res.status(400).json({ error: 'Each item must have productId and positive quantity' });
    }
  }

  try {
    // Step 1: Validate — verify all cart items have sufficient stock
    const productIds = items.map((item) => item.productId);
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const stockQuery = `
      SELECT id, name, price, stock_quantity
      FROM products
      WHERE id = ANY($1::uuid[]) AND is_active = TRUE
    `;
    
    const stockResult = await pool.query(stockQuery, [productIds]);
    const productsMap = new Map(stockResult.rows.map((p) => [p.id, p]));

    // Check for missing or out-of-stock items
    const outOfStockItems = [];
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        outOfStockItems.push(item.productId);
        continue;
      }
      if (product.stock_quantity < item.quantity) {
        outOfStockItems.push(item.productId);
        continue;
      }
      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: parseFloat(product.price),
      });
      totalAmount += item.quantity * parseFloat(product.price);
    }

    if (outOfStockItems.length > 0) {
      return res.status(409).json({
        error: 'Insufficient stock',
        outOfStockItems,
      });
    }

    // Step 2: Reserve + Record — within a single DB transaction
    const orderId = await withTransaction(async (client) => {
      // Decrement stock for each item
      for (const item of orderItems) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.productId]
        );
      }

      // Insert order record
      const orderResult = await client.query(
        `INSERT INTO orders (customer_id, customer_email, status, total_amount)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [customerId, customerEmail, 'pending', totalAmount.toFixed(2)]
      );
      const newOrderId = orderResult.rows[0].id;

      // Insert order_items records
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [newOrderId, item.productId, item.quantity, item.unitPrice.toFixed(2)]
        );
      }

      return newOrderId;
    });

    // Step 3: Publish — send order event to SQS queue
    const orderEvent = {
      orderId,
      customerId,
      customerEmail,
      items: orderItems,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    try {
      await publishOrderEvent(orderEvent);
    } catch (sqsErr) {
      console.error('SQS publish failed:', sqsErr.message);
      // Order is recorded but invoice delayed — log error and return 500
      return res.status(500).json({ error: 'Order recorded but invoice generation delayed' });
    }

    // Step 4: Clear — delete cart from Redis (best-effort)
    try {
      await redis.del(`cart:${customerId}`);
    } catch (redisErr) {
      console.warn('Cart clear failed (best-effort):', redisErr.message);
      // Continue — cart TTL will eventually expire
    }

    return res.status(201).json({
      orderId,
      status: 'pending',
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  } catch (err) {
    console.error('Checkout error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /orders/:id
 * Retrieve order status (requires Customer JWT)
 */
router.get('/orders/:id', requireCustomerAuth, async (req, res) => {
  const { id } = req.params;
  const customerId = req.user.sub;

  try {
    const result = await pool.query(
      `SELECT id, customer_id, customer_email, status, total_amount, created_at
       FROM orders
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // Ensure the order belongs to the requesting customer
    if (order.customer_id !== customerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({
      orderId: order.id,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      createdAt: order.created_at,
    });
  } catch (err) {
    console.error('Get order error:', err.message);
    if (err.status === 503) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

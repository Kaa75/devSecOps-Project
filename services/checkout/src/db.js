'use strict';

const { Pool } = require('pg');
const CircuitBreaker = require('opossum');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Run a function inside a PostgreSQL transaction.
 * fn receives the client and must use it for all queries.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const breakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(query, breakerOptions);

breaker.fallback(() => {
  const err = new Error('Service temporarily unavailable');
  err.status = 503;
  throw err;
});

module.exports = { breaker, withTransaction, pool };

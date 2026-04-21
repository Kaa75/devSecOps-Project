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

module.exports = { breaker, pool };

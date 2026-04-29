-- Migration 002: Create orders table
-- Requirements: 8.6, 8.7, 3.2

CREATE TABLE IF NOT EXISTS orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    status         VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_amount   NUMERIC(10, 2) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

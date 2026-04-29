# Database Migrations

SQL migration files for the ShopCloud PostgreSQL schema. All migrations are idempotent — safe to run multiple times using `IF NOT EXISTS` guards.

## Files

| File | Description |
|------|-------------|
| `001_create_products.sql` | `products` table with category and full-text search indexes |
| `002_create_orders.sql` | `orders` table with customer lookup index |
| `003_create_order_items.sql` | `order_items` table with FK references and order lookup index |

## Indexes

| Index | Table | Type | Notes |
|-------|-------|------|-------|
| `idx_products_category` | `products` | B-tree (partial) | Active products only (`WHERE is_active = TRUE`) |
| `idx_products_search` | `products` | GIN | Full-text search on `name` and `description` |
| `idx_orders_customer` | `orders` | B-tree | Lookup orders by Cognito `customer_id` |
| `idx_order_items_order` | `order_items` | B-tree | Lookup line items by `order_id` |

## Running Migrations

Apply in order against your PostgreSQL instance:

```bash
psql "$DATABASE_URL" -f 001_create_products.sql
psql "$DATABASE_URL" -f 002_create_orders.sql
psql "$DATABASE_URL" -f 003_create_order_items.sql
```

Or run all at once:

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

## Notes

- Migrations must be applied in numeric order — `order_items` depends on both `products` and `orders`.
- The `idx_products_search` GIN index uses `COALESCE(description, '')` to handle products with a `NULL` description.
- The `customer_id` column stores the Cognito `sub` claim (a UUID-like string).

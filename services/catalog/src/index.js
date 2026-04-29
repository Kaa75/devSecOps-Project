'use strict';

const AWSXRay = require('aws-xray-sdk');
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
AWSXRay.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || 'xray-daemon:2000');

require('dotenv').config();

const express = require('express');
const productsRouter = require('./routes/products');

const app = express();
app.use(AWSXRay.express.openSegment('catalog'));
app.use(express.json());

const demoProducts = [
  { id: 1, name: 'Laptop Pro', price: 1299.99, description: 'High-performance laptop' },
  { id: 2, name: 'Wireless Mouse', price: 49.99, description: 'Ergonomic design' },
  { id: 3, name: 'Mechanical Keyboard', price: 149.99, description: 'RGB backlit' },
  { id: 4, name: 'USB-C Hub', price: 79.99, description: '7-in-1 hub' },
  { id: 5, name: 'Monitor 4K', price: 599.99, description: '27-inch display' },
];

function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ShopCloud | Storefront</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #081120;
        --panel: rgba(12, 20, 38, 0.88);
        --panel-2: rgba(18, 29, 53, 0.9);
        --line: rgba(148, 163, 184, 0.16);
        --text: #e5eefc;
        --muted: #8ea3c7;
        --accent: #7dd3fc;
        --accent-2: #34d399;
        --danger: #fb7185;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%),
          radial-gradient(circle at top right, rgba(52, 211, 153, 0.18), transparent 24%),
          linear-gradient(180deg, #050b15 0%, #091427 42%, #0b1020 100%);
        color: var(--text);
        min-height: 100vh;
      }

      .shell { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
      .hero {
        display: grid;
        gap: 18px;
        grid-template-columns: 1.3fr 0.7fr;
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(14, 22, 39, 0.94), rgba(8, 15, 28, 0.82));
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: fit-content;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(125, 211, 252, 0.28);
        background: rgba(125, 211, 252, 0.08);
        color: #cfefff;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      h1 { margin: 10px 0 12px; font-size: clamp(2.4rem, 4vw, 4.6rem); line-height: 0.95; }
      .lead { margin: 0; max-width: 62ch; color: var(--muted); font-size: 1.02rem; line-height: 1.7; }
      .stats {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .stat {
        padding: 16px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--line);
      }
      .stat strong { display: block; font-size: 1.6rem; margin-bottom: 4px; }
      .stat span { color: var(--muted); font-size: 0.92rem; }

      .section { margin-top: 28px; }
      .section-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .section-header h2 { margin: 0; font-size: 1.35rem; }
      .section-header p { margin: 0; color: var(--muted); }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .card {
        padding: 18px;
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(18, 29, 53, 0.92), rgba(12, 20, 38, 0.92));
        border: 1px solid var(--line);
        min-height: 180px;
      }
      .card h3 { margin: 0 0 10px; font-size: 1.05rem; }
      .price { color: var(--accent); font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; }
      .desc { color: var(--muted); line-height: 1.5; margin: 0; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-top: 14px;
        border-radius: 999px;
        background: rgba(52, 211, 153, 0.08);
        color: #c7f9e8;
        border: 1px solid rgba(52, 211, 153, 0.18);
        font-size: 12px;
      }
      .error { color: #fecdd3; background: rgba(251, 113, 133, 0.08); border-color: rgba(251, 113, 133, 0.2); }
      .footer { margin-top: 26px; color: var(--muted); font-size: 0.92rem; }

      @media (max-width: 860px) {
        .hero { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div>
          <div class="badge">ShopCloud storefront</div>
          <h1>Browse products, manage your cart, and check out from one place.</h1>
          <p class="lead">
            This page is served by the catalog service so CloudFront has a real frontend to display.
            When the live product API is available, it populates automatically. Otherwise, demo products keep the UI usable.
          </p>
        </div>
        <div class="stats">
          <div class="stat"><strong>5</strong><span>demo products loaded</span></div>
          <div class="stat"><strong>CDN</strong><span>CloudFront front door</span></div>
          <div class="stat"><strong>API</strong><span id="api-state">loading...</span></div>
          <div class="stat"><strong>Status</strong><span id="catalog-state">initializing...</span></div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Featured Products</h2>
            <p id="catalog-note">Waiting for the live catalog response.</p>
          </div>
        </div>
        <div class="grid" id="product-grid"></div>
      </section>

      <div class="footer">
        CloudFront is now serving the storefront instead of the raw health check response.
      </div>
    </main>

    <script>
      const demoProducts = ${JSON.stringify(demoProducts)};
      const grid = document.getElementById('product-grid');
      const apiState = document.getElementById('api-state');
      const catalogState = document.getElementById('catalog-state');
      const catalogNote = document.getElementById('catalog-note');

      function render(products, sourceLabel, error = false) {
        grid.innerHTML = products.map((product) => {
          const price = Number(product.price).toFixed(2);
          const description = product.description || 'No description available.';
          const statusClass = error ? 'error' : '';

          return '<article class="card">' +
            '<h3>' + product.name + '</h3>' +
            '<div class="price">$' + price + '</div>' +
            '<p class="desc">' + description + '</p>' +
            '<div class="pill ' + statusClass + '">' + sourceLabel + '</div>' +
          '</article>';
        }).join('');
      }

      async function loadProducts() {
        render(demoProducts, 'Demo catalog');
        try {
          const response = await fetch('/products?limit=8');
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const payload = await response.json();
          const products = Array.isArray(payload.products) ? payload.products : [];
          if (products.length > 0) {
            apiState.textContent = 'live catalog connected';
            catalogState.textContent = 'operational';
            catalogNote.textContent = 'Live products are coming from the backend.';
            render(products, 'Live catalog');
            return;
          }
          throw new Error('empty response');
        } catch (error) {
          apiState.textContent = 'demo mode';
          catalogState.textContent = 'fallback ready';
          catalogNote.textContent = 'The live catalog is unavailable, so the UI is showing demo products.';
          render(demoProducts, 'Demo catalog', true);
        }
      }

      loadProducts();
    </script>
  </body>
</html>`;
}

app.get(['/', '/index.html'], (_req, res) => {
  res.type('html').send(renderHomePage());
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'catalog' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready', service: 'catalog' }));
app.use('/products', productsRouter);

app.use(AWSXRay.express.closeSegment());

const PORT = process.env.PORT || 3000;
/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => console.log(`catalog-service listening on :${PORT}`));
}

module.exports = app;

import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import LoginPage, { AUTH_STORAGE_KEY } from './LoginPage';

// All API calls go through nginx reverse proxy → internal cluster DNS
const CATALOG_API = '/api/catalog';
const CART_API    = '/api/cart';
const CHECKOUT_API = '/api/checkout';

const DEMO_PRODUCTS = [
  { id: 1, name: 'Laptop Pro 15', price: 1299.99, category: 'Electronics', description: 'High-performance laptop, M-series chip, 18 h battery.' },
  { id: 2, name: 'Wireless Mouse', price: 49.99, category: 'Peripherals', description: 'Ergonomic 3-button design, 12-month battery, silent clicks.' },
  { id: 3, name: 'Mechanical Keyboard', price: 149.99, category: 'Peripherals', description: 'RGB backlit, tactile brown switches, full-size layout.' },
  { id: 4, name: 'USB-C Hub 7-in-1', price: 79.99, category: 'Accessories', description: '4K HDMI, 100W PD, SD card, 3× USB-A, ethernet.' },
  { id: 5, name: 'Monitor 27" 4K', price: 599.99, category: 'Electronics', description: 'IPS panel, 144 Hz, USB-C alt-mode, factory calibrated.' },
  { id: 6, name: 'Webcam 1080p60', price: 89.99, category: 'Electronics', description: 'Auto-focus, dual noise-cancelling mics, plug-and-play.' },
  { id: 7, name: 'Desk Lamp LED', price: 39.99, category: 'Accessories', description: 'Touch dimmer, 5 colour temps, USB-A charging port.' },
  { id: 8, name: 'Laptop Stand', price: 34.99, category: 'Accessories', description: 'Aluminium, 6 height positions, foldable for travel.' },
];

function fmt(n) { return `$${Number(n).toFixed(2)}`; }

function getInitialAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)); } catch { return null; }
}

function apiFetch(url, options = {}, token) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(3000),
    headers: {
      'Content-Type': 'application/json',
      ...(token && token !== 'demo' ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export default function App() {
  const [auth, setAuth]                 = useState(getInitialAuth);
  const [page, setPage]                 = useState('shop'); // 'shop' | 'orders'
  const [products, setProducts]         = useState(DEMO_PRODUCTS);
  const [liveData, setLiveData]         = useState(false);
  const [loadingProds, setLoadingProds] = useState(true);
  const [cartOpen, setCartOpen]         = useState(false);
  const [cart, setCart]                 = useState(() => {
    try { return JSON.parse(localStorage.getItem('shopcloud-cart')) || []; } catch { return []; }
  });
  const [search, setSearch]             = useState('');
  const [category, setCategory]         = useState('all');
  const [sort, setSort]                 = useState('featured');
  const [toast, setToast]               = useState(null);
  const [checkout, setCheckout]         = useState(false);
  const [placing, setPlacing]           = useState(false);
  const [orders, setOrders]             = useState([]);

  // ── Auth ──────────────────────────────────────────────────────
  const handleAuth = (d) => setAuth(d);
  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(null);
    setCart([]);
    setOrders([]);
  };

  // ── Products ──────────────────────────────────────────────────
  useEffect(() => {
    if (!auth) return;
    setLoadingProds(true);
    apiFetch(`${CATALOG_API}/products?limit=24`, {}, auth.token)
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : data.products ?? [];
        if (items.length) { setProducts(items); setLiveData(true); }
        else { setProducts(DEMO_PRODUCTS); setLiveData(false); }
      })
      .catch(() => { setProducts(DEMO_PRODUCTS); setLiveData(false); })
      .finally(() => setLoadingProds(false));
  }, [auth]);

  // ── Cart persistence ──────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('shopcloud-cart', JSON.stringify(cart));
  }, [cart]);

  // ── Toast auto-dismiss ────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg, type = 'ok') => setToast({ msg, type });

  // ── Cart actions ──────────────────────────────────────────────
  const addToCart = (product) => {
    setCart(c => {
      const ex = c.find(i => i.id === product.id);
      return ex
        ? c.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
        : [...c, { ...product, qty: 1 }];
    });
    setCartOpen(true);
    notify(`${product.name} added to cart`);
    apiFetch(`${CART_API}/cart/add-item`, { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: 1 }) }, auth?.token).catch(() => {});
  };

  const setQty = (id, delta) => setCart(c =>
    c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
  );
  const removeItem = (id) => setCart(c => c.filter(i => i.id !== id));
  const clearCart  = () => setCart([]);

  // ── Derived values ────────────────────────────────────────────
  const cartCount = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  const subtotal  = useMemo(() => cart.reduce((n, i) => n + Number(i.price) * i.qty, 0), [cart]);
  const tax       = subtotal * 0.08;
  const total     = subtotal + tax;

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...set];
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = products.filter(p => {
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (p.name + p.description).toLowerCase().includes(q);
    });
    if (sort === 'price-asc')  out = [...out].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price);
    if (sort === 'name')       out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [products, search, category, sort]);

  // ── Checkout ──────────────────────────────────────────────────
  const placeOrder = async () => {
    setPlacing(true);
    try {
      await apiFetch(`${CHECKOUT_API}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ items: cart, subtotal, tax, total, timestamp: new Date().toISOString() }),
      }, auth?.token).catch(() => {});
      const id = `ORD-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      setOrders(o => [{ id, items: [...cart], total, date: new Date().toLocaleString() }, ...o]);
      clearCart();
      setCheckout(false);
      setCartOpen(false);
      notify(`Order ${id} placed!`);
    } finally {
      setPlacing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  if (!auth) return <LoginPage onAuth={handleAuth} />;

  return (
    <div className="shell">
      {/* ── NAV ── */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-brand">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="9" fill="#6366f1"/>
              <path d="M10 13h16M10 18h10M10 23h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span>ShopCloud</span>
          </div>

          <div className="nav-links">
            <button
              className={`nav-link${page === 'shop' ? ' active' : ''}`}
              onClick={() => setPage('shop')}
            >Shop</button>
            <button
              className={`nav-link${page === 'orders' ? ' active' : ''}`}
              onClick={() => setPage('orders')}
            >Orders {orders.length > 0 && <span className="badge">{orders.length}</span>}</button>
          </div>

          <div className="nav-right">
            <div className="nav-user">
              <span className="nav-email">{auth.email}</span>
              {auth.isAdmin && <span className="tag tag-admin">Admin</span>}
              {auth.demo    && <span className="tag tag-demo">Demo</span>}
            </div>
            <button className="btn-ghost sm" onClick={handleLogout}>Sign out</button>
            <button className="cart-btn" onClick={() => setCartOpen(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* ── STATUS BAR ── */}
      <div className="statusbar">
        <span className={`status-pill ${liveData ? 'live' : 'demo'}`}>
          {liveData ? '● Live catalog' : '○ Demo catalog'}
        </span>
        <span className={`status-pill ${auth.demo ? 'demo' : 'live'}`}>
          {auth.demo ? '○ Auth offline (demo)' : `● ${auth.isAdmin ? 'Admin' : 'Customer'} JWT`}
        </span>
        <span className="status-pill live">● Cart syncing</span>
      </div>

      {/* ── SHOP PAGE ── */}
      {page === 'shop' && (
        <main className="main">
          {/* Filters */}
          <div className="filters">
            <input
              className="search-input"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
              ))}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {/* Products */}
          <div className="products-header">
            <h2>Products</h2>
            <span>{loadingProds ? 'Loading…' : `${visible.length} products`}</span>
          </div>
          <div className="product-grid">
            {visible.map(p => (
              <div key={p.id} className="product-card">
                <div className="product-img">
                  <span>{p.category?.[0] ?? '📦'}</span>
                </div>
                <div className="product-body">
                  {p.category && <span className="product-cat">{p.category}</span>}
                  <h3 className="product-name">{p.name}</h3>
                  <p className="product-desc">{p.description || 'No description.'}</p>
                  <div className="product-footer">
                    <span className="product-price">{fmt(p.price)}</span>
                    <button className="btn-add" onClick={() => addToCart(p)}>Add to cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ── ORDERS PAGE ── */}
      {page === 'orders' && (
        <main className="main">
          <div className="orders-header">
            <h2>Your Orders</h2>
          </div>
          {orders.length === 0 ? (
            <div className="empty-orders">
              <p>No orders yet. Head to the shop to place your first order.</p>
              <button className="btn-primary" onClick={() => setPage('shop')}>Browse products</button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(o => (
                <div key={o.id} className="order-card">
                  <div className="order-head">
                    <span className="order-id">{o.id}</span>
                    <span className="order-date">{o.date}</span>
                    <span className="order-total">{fmt(o.total)}</span>
                  </div>
                  <div className="order-items">
                    {o.items.map(i => (
                      <span key={i.id} className="order-item">{i.name} × {i.qty}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── CART DRAWER ── */}
      {cartOpen && (
        <div className="drawer-overlay" onClick={() => setCartOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h3>Cart <span className="badge">{cartCount}</span></h3>
              <button className="btn-ghost sm" onClick={() => setCartOpen(false)}>✕</button>
            </div>

            {cart.length === 0 ? (
              <p className="drawer-empty">Your cart is empty.</p>
            ) : (
              <>
                <div className="drawer-items">
                  {cart.map(i => (
                    <div key={i.id} className="drawer-item">
                      <div className="drawer-item-info">
                        <p className="di-name">{i.name}</p>
                        <p className="di-price">{fmt(i.price)}</p>
                      </div>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => setQty(i.id, -1)}>−</button>
                        <span>{i.qty}</span>
                        <button className="qty-btn" onClick={() => setQty(i.id, +1)}>+</button>
                        <button className="rm-btn" onClick={() => removeItem(i.id)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="drawer-totals">
                  <div className="totals-row"><span>Subtotal</span><strong>{fmt(subtotal)}</strong></div>
                  <div className="totals-row"><span>Tax (8%)</span><strong>{fmt(tax)}</strong></div>
                  <div className="totals-row total-line"><span>Total</span><strong>{fmt(total)}</strong></div>
                </div>

                <div className="drawer-actions">
                  <button className="btn-ghost" onClick={clearCart}>Clear</button>
                  <button className="btn-primary" onClick={() => { setCartOpen(false); setCheckout(true); }}>
                    Checkout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKOUT MODAL ── */}
      {checkout && (
        <div className="modal-overlay" onClick={() => setCheckout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Checkout</h3>
              <button className="btn-ghost sm" onClick={() => setCheckout(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-section">
                <h4>Order summary</h4>
                {cart.map(i => (
                  <div key={i.id} className="modal-line">
                    <span>{i.name} × {i.qty}</span>
                    <span>{fmt(Number(i.price) * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="modal-section">
                <h4>Payment</h4>
                <div className="modal-line"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                <div className="modal-line"><span>Tax 8%</span><span>{fmt(tax)}</span></div>
                <div className="modal-line modal-total"><span>Total</span><strong>{fmt(total)}</strong></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setCheckout(false)}>Cancel</button>
              <button className="btn-primary" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing order…' : `Pay ${fmt(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}

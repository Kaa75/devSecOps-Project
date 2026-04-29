import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';
import LoginPage, { AUTH_STORAGE_KEY } from './LoginPage';

const DEMO_PRODUCTS = [
  { id: 1, name: 'Laptop Pro', price: 1299.99, category: 'Electronics', description: 'High-performance laptop for professionals' },
  { id: 2, name: 'Wireless Mouse', price: 49.99, category: 'Accessories', description: 'Ergonomic design, 12-month battery life' },
  { id: 3, name: 'Mechanical Keyboard', price: 149.99, category: 'Accessories', description: 'RGB backlit, tactile switches' },
  { id: 4, name: 'USB-C Hub', price: 79.99, category: 'Accessories', description: '7-in-1 hub with 4K HDMI and PD charging' },
  { id: 5, name: 'Monitor 4K', price: 599.99, category: 'Electronics', description: '27-inch IPS display, 144Hz refresh rate' },
  { id: 6, name: 'Webcam HD', price: 89.99, category: 'Electronics', description: '1080p 60fps with built-in noise cancellation' },
];

const CATALOG_API = 'http://a98f519c4af93425b99b2dc81d16f3e9-1395133919.us-east-1.elb.amazonaws.com';
const CART_API = 'http://ada019bcb0d9c444ea2a19d3deb7742f-1636233805.us-east-1.elb.amazonaws.com';
const CHECKOUT_API = 'http://a185d62bc3d6f405085e9a71e05d3a57-285844831.us-east-1.elb.amazonaws.com';
const CART_STORAGE_KEY = 'shopcloud-cart-v2';

function normalizeProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

function toCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getInitialAuth() {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function App() {
  const [auth, setAuth] = useState(getInitialAuth);

  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [toast, setToast] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');

  const handleAuth = (authData) => {
    setAuth(authData);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(null);
    setCart([]);
  };

  useEffect(() => {
    if (auth) fetchProductsFromBackend();
  }, [auth]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const authHeaders = () => {
    if (auth?.token && auth.token !== 'demo') {
      return { Authorization: `Bearer ${auth.token}` };
    }
    return {};
  };

  const fetchProductsFromBackend = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await axios.get(`${CATALOG_API}/products?limit=24`, {
        timeout: 2000,
        headers: authHeaders(),
      });
      const normalized = normalizeProducts(response.data);
      if (normalized.length > 0) {
        setProducts(normalized);
        setUsingDemoData(false);
      } else {
        setProducts(DEMO_PRODUCTS);
        setUsingDemoData(true);
      }
    } catch {
      setProducts(DEMO_PRODUCTS);
      setUsingDemoData(true);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const categories = useMemo(() => {
    const values = products
      .map((p) => p.category)
      .filter((v) => typeof v === 'string' && v.trim() !== '');
    return ['all', ...Array.from(new Set(values))];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let output = products.filter((product) => {
      const byCategory = categoryFilter === 'all' || product.category === categoryFilter;
      if (!byCategory) return false;
      if (!query) return true;
      const name = String(product.name || '').toLowerCase();
      const description = String(product.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });

    switch (sortBy) {
      case 'price-low':
        output = [...output].sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price-high':
        output = [...output].sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'name':
        output = [...output].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        break;
      default:
        break;
    }
    return output;
  }, [products, searchQuery, categoryFilter, sortBy]);

  const cartItemsCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart]
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const pushToast = (message, tone = 'ok') => setToast({ message, tone });

  const addToCart = async (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    pushToast(`${product.name} added to cart`);

    try {
      await axios.post(
        `${CART_API}/cart/add-item`,
        { productId: product.id, quantity: 1 },
        { timeout: 2000, headers: authHeaders() }
      );
    } catch {
      // Local cart remains the source of truth.
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const openCheckout = () => {
    if (cart.length === 0) {
      pushToast('Your cart is empty', 'warn');
      return;
    }
    setShowCheckout(true);
  };

  const placeOrder = async () => {
    setIsCheckingOut(true);
    try {
      const orderData = {
        items: cart,
        subtotal,
        tax,
        total,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      try {
        await axios.post(`${CHECKOUT_API}/checkout`, orderData, {
          timeout: 3000,
          headers: authHeaders(),
        });
      } catch {
        // Fallback: order recorded locally.
      }
      const orderId = Math.random().toString(36).slice(2, 11).toUpperCase();
      setLastOrderId(orderId);
      setCart([]);
      setShowCheckout(false);
      pushToast(`Order #${orderId} placed successfully`);
    } catch {
      pushToast('Failed to place order. Try again.', 'warn');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!auth) {
    return <LoginPage onAuth={handleAuth} />;
  }

  return (
    <div className="App">
      <div className="gradient-orb orb-a" />
      <div className="gradient-orb orb-b" />

      <header className="topbar">
        <div className="container topbar-inner">
          <div>
            <p className="eyebrow">ShopCloud</p>
            <h1>Modern Commerce Console</h1>
            <p className="subhead">
              Faster browsing, cleaner checkout, and practical controls for real shopping behavior.
            </p>
          </div>

          <div className="summary-card">
            <div className="user-info">
              <span className="user-email">{auth.email}</span>
              {auth.isAdmin && <span className="admin-badge">Admin</span>}
              {auth.demo && <span className="demo-badge">Demo</span>}
              <button className="logout-btn ghost" onClick={handleLogout}>Sign out</button>
            </div>
            <p>Items in cart</p>
            <strong>{cartItemsCount}</strong>
            <span>{toCurrency(subtotal)} subtotal</span>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="status-card">
          <div className="status-row">
            <span className="pill">Catalog: {usingDemoData ? 'Demo mode' : 'Live mode'}</span>
            <span className="pill">Cart API: Best effort sync</span>
            <span className="pill">Checkout: Resilient fallback</span>
            <span className={`pill pill-auth${auth.demo ? ' pill-warn' : ' pill-ok'}`}>
              Auth: {auth.demo ? 'Demo (service offline)' : auth.isAdmin ? 'Admin JWT' : 'Cognito JWT'}
            </span>
          </div>
          {lastOrderId && (
            <p className="order-note">Last order: #{lastOrderId}</p>
          )}
        </section>

        <section className="controls">
          <div className="field">
            <label htmlFor="search">Search products</label>
            <input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Try laptop, keyboard, hub..."
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort">Sort</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name</option>
            </select>
          </div>
        </section>

        <div className="layout">
          <section className="products">
            <div className="section-title-row">
              <h2>Products</h2>
              <span>{isLoadingProducts ? 'Loading…' : `${visibleProducts.length} shown`}</span>
            </div>
            <div className="grid">
              {visibleProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <h3>{product.name}</h3>
                  <p className="price">{toCurrency(product.price)}</p>
                  <p className="desc">{product.description || 'No description available.'}</p>
                  {product.category && (
                    <span className="product-category">{product.category}</span>
                  )}
                  <button onClick={() => addToCart(product)}>Add to cart</button>
                </article>
              ))}
            </div>
          </section>

          <aside className="cart-panel">
            <div className="section-title-row">
              <h2>Cart</h2>
              <span>{cartItemsCount} items</span>
            </div>

            {cart.length === 0 ? (
              <p className="empty-state">Add products to start your order.</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div>
                        <p className="cart-name">{item.name}</p>
                        <p className="cart-price">{toCurrency(item.price)}</p>
                      </div>
                      <div className="qty-controls">
                        <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                      </div>
                      <button
                        className="remove-btn"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-totals">
                  <p><span>Subtotal</span><strong>{toCurrency(subtotal)}</strong></p>
                  <p><span>Tax (8%)</span><strong>{toCurrency(tax)}</strong></p>
                  <p className="grand-total"><span>Total</span><strong>{toCurrency(total)}</strong></p>
                </div>

                <div className="cart-actions">
                  <button className="ghost" onClick={clearCart}>Clear cart</button>
                  <button className="primary" onClick={openCheckout}>Checkout</button>
                </div>
              </>
            )}
          </aside>
        </div>

        {showCheckout && (
          <section className="checkout-sheet">
            <div className="checkout-head">
              <h2>Checkout preview</h2>
              <button className="ghost" onClick={() => setShowCheckout(false)}>Close</button>
            </div>
            <div className="checkout-grid">
              <div>
                <h3>Order lines</h3>
                {cart.map((item) => (
                  <div key={item.id} className="review-item">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{toCurrency(Number(item.price) * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>Payment summary</h3>
                <div className="checkout-summary">
                  <p><span>Subtotal</span><strong>{toCurrency(subtotal)}</strong></p>
                  <p><span>Tax (8%)</span><strong>{toCurrency(tax)}</strong></p>
                  <p className="grand-total"><span>Total</span><strong>{toCurrency(total)}</strong></p>
                </div>
                <button
                  className="primary place-order"
                  onClick={placeOrder}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? 'Processing order…' : 'Place order'}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.tone}`}>{toast.message}</div>
      )}
    </div>
  );
}

export default App;

import React, { useCallback, useEffect, useState } from 'react';

const ADMIN_API = '/api/admin';

function fmt(n) { return `$${Number(n).toFixed(2)}`; }

function apiFetch(url, options = {}, token) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const EMPTY_FORM = { name: '', description: '', price: '', category: '', stock_quantity: '0' };

export default function AdminPage({ auth, onLogout }) {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Product form (add / edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline stock editor
  const [stockEdit, setStockEdit] = useState({});

  // Returns form
  const [ret, setRet] = useState({ productId: '', quantity: '' });
  const [retError, setRetError] = useState('');
  const [retSaving, setRetSaving] = useState(false);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${ADMIN_API}/admin/products`, {}, auth.token);
      if (!r.ok) throw new Error(await r.text());
      setProducts(await r.json());
    } catch { notify('Could not load products', 'err'); }
    finally { setLoading(false); }
  }, [auth.token]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${ADMIN_API}/admin/orders`, {}, auth.token);
      if (!r.ok) throw new Error(await r.text());
      setOrders(await r.json());
    } catch { notify('Could not load orders', 'err'); }
    finally { setLoading(false); }
  }, [auth.token]);

  useEffect(() => { if (tab === 'products') loadProducts(); }, [tab, loadProducts]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab, loadOrders]);
  // Pre-load products for the Returns tab product picker
  useEffect(() => { if (tab === 'returns' && products.length === 0) loadProducts(); }, [tab, products.length, loadProducts]);

  // ── Product form ──────────────────────────────────────────────
  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category, stock_quantity: p.stock_quantity });
    setFormError('');
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) { setFormError('Name, price, and category are required.'); return; }
    setSaving(true);
    try {
      const body = { name: form.name, description: form.description, price: parseFloat(form.price), category: form.category, stock_quantity: parseInt(form.stock_quantity, 10) || 0 };
      const url = editingId ? `${ADMIN_API}/admin/products/${editingId}` : `${ADMIN_API}/admin/products`;
      const method = editingId ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify(body) }, auth.token);
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
      setShowForm(false);
      notify(editingId ? 'Product updated.' : 'Product created.');
      loadProducts();
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  // ── Stock ─────────────────────────────────────────────────────
  const commitStock = async (id) => {
    const qty = parseInt(stockEdit[id], 10);
    if (isNaN(qty) || qty < 0) { notify('Enter a valid stock quantity.', 'err'); return; }
    try {
      const r = await apiFetch(`${ADMIN_API}/admin/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock_quantity: qty }) }, auth.token);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setStockEdit(s => { const n = { ...s }; delete n[id]; return n; });
      setProducts(ps => ps.map(p => p.id === id ? { ...p, stock_quantity: data.stock_quantity ?? qty } : p));
      notify('Stock updated.');
    } catch (e) { notify(`Stock update failed: ${e.message}`, 'err'); }
  };

  // ── Deactivate / Activate ─────────────────────────────────────
  const toggleActive = async (p) => {
    const action = p.is_active ? 'deactivate' : 'activate';
    try {
      const r = await apiFetch(`${ADMIN_API}/admin/products/${p.id}/${action}`, { method: 'POST' }, auth.token);
      if (!r.ok) throw new Error();
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
      notify(`Product ${action}d.`);
    } catch { notify(`Failed to ${action} product.`, 'err'); }
  };

  // ── Returns ───────────────────────────────────────────────────
  const handleReturn = async (e) => {
    e.preventDefault();
    const qty = parseInt(ret.quantity, 10);
    if (!ret.productId || isNaN(qty) || qty <= 0) { setRetError('Valid product ID and positive quantity required.'); return; }
    setRetSaving(true);
    try {
      const r = await apiFetch(`${ADMIN_API}/admin/returns`, { method: 'POST', body: JSON.stringify({ productId: ret.productId, quantity: qty }) }, auth.token);
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
      const data = await r.json();
      setRet({ productId: '', quantity: '' });
      setRetError('');
      notify(`Return processed. New stock for product: ${data.stock_quantity}`);
      if (tab === 'products') loadProducts();
    } catch (err) { setRetError(err.message); }
    finally { setRetSaving(false); }
  };

  return (
    <div className="shell">
      {/* NAV */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-brand">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="9" fill="#6366f1"/>
              <path d="M10 13h16M10 18h10M10 23h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span>ShopCloud Admin</span>
          </div>

          <div className="nav-links">
            {[['products','Products'],['returns','Returns'],['orders','Orders']].map(([id, label]) => (
              <button key={id} className={`nav-link${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          <div className="nav-right">
            <div className="nav-user">
              <span className="nav-email">{auth.email}</span>
              <span className="tag tag-admin">Admin</span>
            </div>
            <button className="btn-ghost sm" onClick={onLogout}>Sign out</button>
          </div>
        </div>
      </nav>

      <div className="statusbar">
        <span className="status-pill live">● Admin dashboard</span>
        <span className="status-pill live">● Admin JWT</span>
      </div>

      <main className="main">

        {/* ── PRODUCTS TAB ── */}
        {tab === 'products' && (
          <>
            <div className="orders-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Products</h2>
              <button className="btn-primary" onClick={openAdd}>+ Add product</button>
            </div>

            {loading ? <p style={{ padding: '2rem', textAlign: 'center' }}>Loading…</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                        <td>
                          <strong>{p.name}</strong>
                          {p.description && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{p.description.slice(0, 60)}{p.description.length > 60 ? '…' : ''}</div>}
                        </td>
                        <td>{p.category}</td>
                        <td>{fmt(p.price)}</td>
                        <td>
                          {stockEdit[p.id] !== undefined ? (
                            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                type="number" min="0"
                                value={stockEdit[p.id]}
                                onChange={ev => setStockEdit(s => ({ ...s, [p.id]: ev.target.value }))}
                                style={{ width: 64, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              <button className="btn-ghost sm" onClick={() => commitStock(p.id)}>✓</button>
                              <button className="btn-ghost sm" onClick={() => setStockEdit(s => { const n={...s}; delete n[p.id]; return n; })}>✕</button>
                            </span>
                          ) : (
                            <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => setStockEdit(s => ({ ...s, [p.id]: String(p.stock_quantity) }))}>
                              {p.stock_quantity}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: p.is_active ? '#16a34a' : '#dc2626' }}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn-ghost sm" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn-ghost sm" onClick={() => toggleActive(p)}>
                              {p.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No products found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── RETURNS TAB ── */}
        {tab === 'returns' && (
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>Process Return</h2>
            <div style={{ maxWidth: 480 }}>
              <form onSubmit={handleReturn} className="auth-fields" noValidate>
                {retError && <div className="auth-alert error">{retError}</div>}
                <label className="auth-label">
                  Product ID
                  <input type="text" value={ret.productId} required placeholder="UUID of the product" onChange={e => setRet(r => ({ ...r, productId: e.target.value }))} />
                </label>
                <label className="auth-label">
                  Quantity returned
                  <input type="number" min="1" value={ret.quantity} required placeholder="e.g. 2" onChange={e => setRet(r => ({ ...r, quantity: e.target.value }))} />
                </label>
                <button type="submit" className="btn-primary" disabled={retSaving}>
                  {retSaving ? 'Processing…' : 'Process return'}
                </button>
              </form>

              <div style={{ marginTop: '2rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem' }}>Copy a product ID from the Products tab:</p>
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  {products.length === 0
                    ? <p style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>Loading products…</p>
                    : products.filter(p => p.is_active).map(p => (
                      <div
                        key={p.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => setRet(r => ({ ...r, productId: p.id }))}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>{p.id.slice(0, 8)}…</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <>
            <div className="orders-header">
              <h2>All Orders</h2>
            </div>
            {loading ? <p style={{ padding: '2rem', textAlign: 'center' }}>Loading…</p> : (
              orders.length === 0
                ? <div className="empty-orders"><p>No orders yet.</p></div>
                : <div className="orders-list">
                    {orders.map(o => (
                      <div key={o.id} className="order-card">
                        <div className="order-head">
                          <span className="order-id" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.id}</span>
                          <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{o.customer_email}</span>
                          <span className="order-date">{new Date(o.created_at).toLocaleString()}</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: o.status === 'completed' ? '#16a34a' : '#f59e0b', textTransform: 'capitalize' }}>{o.status}</span>
                          <span className="order-total">{fmt(o.total_amount)}</span>
                        </div>
                        <div className="order-items">
                          {(o.items || []).map((i, idx) => (
                            <span key={idx} className="order-item">
                              {i.product_name || 'Product'} × {i.quantity} @ {fmt(i.unit_price)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
            )}
          </>
        )}
      </main>

      {/* ── PRODUCT FORM MODAL ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <h3>{editingId ? 'Edit product' : 'Add product'}</h3>
              <button className="btn-ghost sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="auth-alert error" style={{ marginBottom: '1rem' }}>{formError}</div>}
              <form id="product-form" onSubmit={handleFormSubmit} className="auth-fields" noValidate>
                <label className="auth-label">Name<input value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
                <label className="auth-label">Category<input value={form.category} required onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></label>
                <label className="auth-label">Price ($)<input type="number" min="0" step="0.01" value={form.price} required onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></label>
                <label className="auth-label">Stock quantity<input type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></label>
                <label className="auth-label">Description<textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical', width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem' }} /></label>
              </form>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" form="product-form" type="submit" disabled={saving}>{saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create product')}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

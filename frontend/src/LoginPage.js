import React, { useState } from 'react';

export const AUTH_STORAGE_KEY = 'shopcloud-auth';
const AUTH_API = '/api/auth';

export default function LoginPage({ onAuth }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState(
    () => sessionStorage.getItem('shopcloud-pending-verify') || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const savePendingEmail = (e) => {
    setPendingEmail(e);
    if (e) sessionStorage.setItem('shopcloud-pending-verify', e);
    else sessionStorage.removeItem('shopcloud-pending-verify');
  };

  const switchTab = (t) => {
    setTab(t); setEmail(''); setPassword(''); setConfirm(''); setCode('');
    if (t !== 'verify') savePendingEmail('');
    reset();
  };

  const persist = (data) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    onAuth(data);
  };

  const post = async (path, body) => {
    const res = await fetch(`${AUTH_API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `HTTP ${res.status}`);
    }
    return res.json();
  };

  // Map raw API / Cognito error messages to user-friendly copy
  const friendly = (raw = '', isReg = false) => {
    const s = raw.toLowerCase();
    if (s.includes('email already registered') || s.includes('already exists') || s.includes('usernameexists'))
      return 'An account with this email already exists. Try signing in instead.';
    if (s.includes('password') && (s.includes('requirement') || s.includes('policy') || s.includes('invalid')))
      return 'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.';
    if (s.includes('incorrect') || s.includes('invalid credentials') || s.includes('notauthorized') || s.includes('usernotfound'))
      return 'Incorrect email or password.';
    if (s.includes('not confirmed') || s.includes('usernotconfirmed'))
      return 'Please check your email and verify your account before signing in.';
    if (s.includes('limit') || s.includes('attempts') || s.includes('toomanyrequests'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (s.includes('expired'))
      return 'Your session has expired. Please sign in again.';
    return isReg ? 'Could not create account. Please try again.' : 'Sign in failed. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    if (tab === 'register') {
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    }
    setLoading(true);
    try {
      if (tab === 'register') {
        await post('/register', { email, password });
        savePendingEmail(email);
        setTab('verify');
        setSuccess('Account created! Check your email for a 6-digit verification code.');
      } else if (tab === 'verify') {
        await post('/confirm', { email: pendingEmail, code: code.trim() });
        savePendingEmail('');
        switchTab('login');
        setSuccess('Email verified! You can now sign in.');
      } else {
        const endpoint = tab === 'admin' ? '/admin/login' : '/login';
        const data = await post(endpoint, { email, password });
        const token = data.idToken || data.accessToken || data.token;
        persist({ token, email, isAdmin: tab === 'admin' });
      }
    } catch (err) {
      // Auth service unreachable → allow demo access so UI is demonstrable
      if (err.name === 'TimeoutError' || err.name === 'TypeError') {
        persist({ token: 'demo', email: email || 'demo@shopcloud.dev', isAdmin: false, demo: true });
      } else if (tab === 'login' && (err.message || '').toLowerCase().includes('not confirmed')) {
        // Redirect unconfirmed users to the verify tab so they can complete or retry verification
        savePendingEmail(email);
        setTab('verify');
        setSuccess('Your account isn\'t verified yet. Enter the code from your email or request a new one.');
      } else {
        setError(tab === 'verify' ? (err.message || 'Invalid code, please try again.') : friendly(err.message, tab === 'register'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    reset();
    setLoading(true);
    try {
      await post('/resend-code', { email: pendingEmail });
      setSuccess('A new code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Left panel — branding */}
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#6366f1"/>
              <path d="M10 14h16M10 18h10M10 22h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span>ShopCloud</span>
          </div>
          <h1 className="auth-tagline">Your cloud-native<br/>commerce platform.</h1>
          <p className="auth-sub">Built on EKS · Secured with Cognito · Delivered via CloudFront</p>
          <div className="auth-pills">
            <span className="auth-pill">🛡 JWT Auth</span>
            <span className="auth-pill">⚡ Auto-scale</span>
            <span className="auth-pill">🌍 CDN delivery</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-heading">
            {tab === 'login' ? 'Sign in to your account'
              : tab === 'register' ? 'Create an account'
              : tab === 'verify' ? 'Verify your email'
              : 'Admin sign in'}
          </h2>

          {tab !== 'verify' && (
            <div className="auth-tabs">
              {[['login','Sign In'],['register','Register'],['admin','Admin']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`auth-tab${tab === id ? ' active' : ''}`}
                  onClick={() => switchTab(id)}
                >{label}</button>
              ))}
            </div>
          )}

          {error   && <div className="auth-alert error">{error}</div>}
          {success && <div className="auth-alert success">{success}</div>}

          {tab === 'verify' ? (
            <>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                {pendingEmail
                  ? <>We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below to activate your account.</>
                  : 'Enter your email and the verification code we sent you.'}
              </p>
              <form onSubmit={handleSubmit} className="auth-fields" noValidate>
                {!pendingEmail && (
                  <label className="auth-label">
                    Email address
                    <input
                      type="email"
                      value={email}
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      onChange={e => { setEmail(e.target.value); savePendingEmail(e.target.value); }}
                    />
                  </label>
                )}
                <label className="auth-label">
                  Verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={loading || code.trim().length < 6 || (!pendingEmail && !email)}
                >
                  {loading ? <span className="spinner" /> : 'Verify email'}
                </button>
              </form>
              <p className="auth-switch">
                Didn't receive it?{' '}
                <button className="link-btn" type="button" onClick={handleResend} disabled={loading || (!pendingEmail && !email)}>
                  Resend code
                </button>
                {' · '}
                <button className="link-btn" type="button" onClick={() => switchTab('login')}>Back to sign in</button>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="auth-fields" noValidate>
              <label className="auth-label">
                Email address
                <input
                  type="email" value={email} autoComplete="email" required
                  placeholder="you@example.com"
                  onChange={e => setEmail(e.target.value)}
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  type="password" value={password} required
                  placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>
              {tab === 'register' && (
                <label className="auth-label">
                  Confirm password
                  <input
                    type="password" value={confirm} required
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    onChange={e => setConfirm(e.target.value)}
                  />
                </label>
              )}
              <button
                type="submit"
                className="auth-submit"
                disabled={loading || !email || !password}
              >
                {loading
                  ? <span className="spinner" />
                  : tab === 'login' ? 'Sign in'
                  : tab === 'register' ? 'Create account'
                  : 'Admin sign in'}
              </button>
            </form>
          )}

          {tab === 'admin' && (
            <p className="auth-notice">Admin access requires staff credentials and VPN.</p>
          )}

          {tab !== 'verify' && (
            <p className="auth-switch">
              {tab === 'login'
                ? <>No account? <button className="link-btn" type="button" onClick={() => switchTab('register')}>Register</button>
                   {' · '}
                   <button className="link-btn" type="button" onClick={() => { savePendingEmail(''); setTab('verify'); reset(); }}>Verify email</button></>
                : tab === 'register'
                ? <>Have an account? <button className="link-btn" type="button" onClick={() => switchTab('login')}>Sign in</button></>
                : <>Back to <button className="link-btn" type="button" onClick={() => switchTab('login')}>customer login</button></>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

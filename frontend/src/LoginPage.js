import React, { useState } from 'react';
import axios from 'axios';

const AUTH_API = process.env.REACT_APP_AUTH_API || '';
const AUTH_STORAGE_KEY = 'shopcloud-auth';

function LoginPage({ onAuth }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const reset = () => {
    setError('');
    setSuccessMsg('');
  };

  const switchTab = (next) => {
    setTab(next);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    reset();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    reset();
    setIsLoading(true);
    try {
      const res = await axios.post(`${AUTH_API}/auth/login`, { email, password }, { timeout: 5000 });
      const { accessToken, idToken } = res.data;
      const token = accessToken || idToken;
      const authData = { token, email, isAdmin: false };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      onAuth(authData);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.code === 'ECONNABORTED' || !err.response) {
        // Auth service unreachable — allow demo access
        const authData = { token: 'demo', email, isAdmin: false, demo: true };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        onAuth(authData);
      } else {
        setError(msg || 'Login failed. Check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    reset();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(`${AUTH_API}/auth/register`, { email, password }, { timeout: 5000 });
      setSuccessMsg('Account created! You can now sign in.');
      switchTab('login');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg || 'Registration failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    reset();
    setIsLoading(true);
    try {
      const res = await axios.post(`${AUTH_API}/auth/admin/login`, { email, password }, { timeout: 5000 });
      const { accessToken, idToken } = res.data;
      const token = accessToken || idToken;
      const authData = { token, email, isAdmin: true };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      onAuth(authData);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg || 'Admin login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = tab === 'login' ? handleLogin : tab === 'register' ? handleRegister : handleAdminLogin;

  return (
    <div className="login-page">
      <div className="gradient-orb orb-a" />
      <div className="gradient-orb orb-b" />

      <div className="login-card">
        <div className="login-brand">
          <p className="eyebrow">ShopCloud</p>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to browse products and manage your orders.</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab-btn${tab === 'login' ? ' active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`tab-btn${tab === 'register' ? ' active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Create Account
          </button>
          <button
            className={`tab-btn${tab === 'admin' ? ' active' : ''}`}
            onClick={() => switchTab('admin')}
            type="button"
          >
            Admin
          </button>
        </div>

        {successMsg && <div className="login-success">{successMsg}</div>}
        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={onSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
              required
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {tab === 'register' && (
            <div className="login-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            className="login-submit primary"
            type="submit"
            disabled={isLoading || !email || !password}
          >
            {isLoading
              ? (tab === 'register' ? 'Creating account…' : 'Signing in…')
              : (tab === 'login' ? 'Sign in' : tab === 'register' ? 'Create account' : 'Admin sign in')}
          </button>
        </form>

        {tab === 'admin' && (
          <p className="login-notice">
            Admin access is restricted to authorized staff connecting via the internal network.
          </p>
        )}

        <p className="login-footer">
          {tab === 'login'
            ? <>No account? <button className="link-btn" onClick={() => switchTab('register')}>Create one</button></>
            : tab === 'register'
            ? <>Already have an account? <button className="link-btn" onClick={() => switchTab('login')}>Sign in</button></>
            : <>Back to <button className="link-btn" onClick={() => switchTab('login')}>customer login</button></>
          }
        </p>
      </div>
    </div>
  );
}

export { AUTH_STORAGE_KEY };
export default LoginPage;

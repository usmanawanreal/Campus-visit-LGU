import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { login, register } from '../services/authService.js';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const goAfterLogin = (userData) => {
    const admin = String(userData?.role || '').toLowerCase() === 'admin';
    navigate(admin ? '/admin/dashboard' : '/map');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user: u, token } = await login(email, password);
      loginSuccess(u, token);
      goAfterLogin(u);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { user: u, token } = await register(name.trim(), email, password);
      loginSuccess(u, token);
      navigate('/map');
    } catch (err) {
      setError(err.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-center">
      <div className="card form-card">
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">
          One account for everyone. Administrators use the same sign-in and go to the dashboard; campus users open the map
          after signing in.
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Sign up
          </button>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="form-footer">
          <Link to="/">← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

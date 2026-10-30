import React, { useState } from 'react';
import { ShieldAlert, LogIn, UserPlus, User, Moon, Sun, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

const Field = ({ label, type = 'text', value, onChange, placeholder, autoComplete, invalid }) => (
  <div className="input-group">
    <label className="input-label">{label}</label>
    <input
      type={type}
      className="input-field"
      placeholder={placeholder}
      value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{ borderColor: invalid ? 'var(--accent-scam)' : 'var(--card-border)' }}
    />
  </div>
);

const LoginScreen = ({ onLogin, isDarkMode, setIsDarkMode }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, signupWithEmail } = useAuth();

  const isSignup = mode === 'signup';

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const validate = () => {
    if (isSignup && !name.trim()) return 'Please enter your name.';
    if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address (e.g. user@example.com).';
    if (!password) return 'Please enter your password.';
    if (isSignup && password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
    if (isSignup && password !== confirm) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setError('');
      setLoading(true);
      if (isSignup) {
        await signupWithEmail(name.trim(), email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      onLogin(false);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      if (err.status === 409) switchToLoginKeepingEmail();
    } finally {
      setLoading(false);
    }
  };

  // "Email already registered" on sign-up: move to Log In with the email filled in.
  const switchToLoginKeepingEmail = () => {
    setMode('login');
    setPassword('');
    setConfirm('');
  };

  const tabStyle = (active) => ({
    flex: 1, padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? 'white' : 'var(--text-secondary)',
    transition: 'all var(--transition-normal)',
  });

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <button
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.5rem' }}
        onClick={() => setIsDarkMode(!isDarkMode)}
        aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="text-center" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
          <ShieldAlert size={48} color="#3b82f6" />
        </div>
        <h1 className="text-h1">Scam Shield</h1>
        <p className="text-sub">AI-powered scam detection for your peace of mind</p>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div role="tablist" style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
          <button type="button" role="tab" aria-selected={!isSignup} style={tabStyle(!isSignup)} onClick={() => switchMode('login')}>
            <LogIn size={16} /> Log In
          </button>
          <button type="button" role="tab" aria-selected={isSignup} style={tabStyle(isSignup)} onClick={() => switchMode('signup')}>
            <UserPlus size={16} /> Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', borderLeft: '3px solid var(--accent-scam)' }}>
              <AlertCircle size={16} className="text-scam" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--accent-scam)' }}>{error}</p>
            </div>
          )}

          {isSignup && (
            <Field label="Name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
          )}
          <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="user@example.com" autoComplete="email" />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : '••••••••'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {isSignup && (
            <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" autoComplete="new-password"
              invalid={confirm.length > 0 && confirm !== password} />
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {isSignup ? <UserPlus size={20} /> : <LogIn size={20} />}
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>

          <p className="text-sub text-center" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
            {isSignup ? 'Already have an account? ' : 'New to Scam Shield? '}
            <button type="button" onClick={() => switchMode(isSignup ? 'login' : 'signup')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              {isSignup ? 'Log in' : 'Create an account'}
            </button>
          </p>
        </form>

        <button type="button" className="btn btn-secondary" onClick={() => onLogin(true)} style={{ background: 'transparent', border: 'none', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', width: '100%' }}>
          <User size={16} /> Continue as Guest
        </button>
        <p className="text-sub text-center" style={{ fontSize: '0.7rem', margin: 0 }}>
          Guest history is kept on this device only.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;

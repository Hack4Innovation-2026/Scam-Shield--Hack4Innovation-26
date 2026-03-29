import React, { useState } from 'react';
import { ShieldAlert, LogIn, User, Moon, Sun, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ onLogin, isDarkMode, setIsDarkMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, signupWithEmail } = useAuth();

  const handleEmailAuth = async (e, isSignup = false) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Both Email and Password are required.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address (e.g., user@example.com).');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      if (isSignup) {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      onLogin(false);
    } catch (err) {
      let errorMessage = 'Failed to authenticate. ' + err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. If you are new, please Sign Up.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use. Please login instead.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <button 
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.5rem' }}
        onClick={() => setIsDarkMode(!isDarkMode)}
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="text-center" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
          <ShieldAlert size={48} color="#3b82f6" />
        </div>
        <h1 className="text-h1">Scam Shield</h1>
        <p className="text-sub">AI-powered scam detection for your peace of mind</p>
      </div>

      <div className="glass-card" style={{ padding: '2rem' }}>
        <form onSubmit={(e) => handleEmailAuth(e, false)}>
          
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', borderLeft: '3px solid var(--accent-scam)' }}>
              <AlertCircle size={16} className="text-scam" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--accent-scam)' }}>{error}</p>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ borderColor: error ? 'var(--accent-scam)' : 'var(--card-border)' }}
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">Password *</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ borderColor: error ? 'var(--accent-scam)' : 'var(--card-border)' }}
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                <LogIn size={20} /> Login
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={(e) => handleEmailAuth(e, true)} disabled={loading}>
                Sign Up
              </button>
            </div>



            <button type="button" className="btn btn-secondary" onClick={() => onLogin(true)} style={{ background: 'transparent', border: 'none', marginTop: '1rem', color: 'var(--text-sub)', fontSize: '0.875rem' }}>
              Bypass Auth for Demo (Guest)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;

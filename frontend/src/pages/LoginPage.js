import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      <path d="M12 17.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L3 4.5v3.8C3 11.1 5.2 13.5 8 14c2.8-.5 5-2.9 5-5.7V4.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5.5 8l1.8 1.8 3.2-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const user = await login(email, password);
      if (user.role === 'gateway_admin') navigate('/gateway');
      else if (user.role === 'bank_officer') navigate('/bank');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background gradients */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '600px', height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,110,247,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        }} />
        {/* Grid dots */}
        <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <defs>
            <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }} className="fade-in">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* Logo icon */}
          <div style={{
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg, rgba(79,110,247,0.15), rgba(79,110,247,0.25))',
            border: '1px solid rgba(79,110,247,0.25)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            color: 'var(--blue)',
            boxShadow: '0 8px 32px rgba(79,110,247,0.15)',
          }}>
            <LockIcon />
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '0.12em', fontWeight: '500', marginBottom: '8px', textTransform: 'uppercase' }}>
            SecureVault
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', fontFamily: 'var(--font-display)', letterSpacing: '-0.8px' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>
            Sign in to your secure account
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.3)',
        }}>
          {error && (
            <div className="fade-in" style={{
              background: 'var(--red-dim)',
              border: '1px solid rgba(244,63,94,0.2)',
              borderRadius: '10px',
              padding: '11px 14px',
              marginBottom: '20px',
              color: 'var(--red)',
              fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '7px', fontWeight: '500', letterSpacing: '0.01em' }}>
                Email address
              </label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@example.com"
                style={{ letterSpacing: '0.01em' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '7px', fontWeight: '500' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: '2px', display: 'flex',
                  }}
                >
                  {showPass ? (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.5 4.2C2.5 5.4 1 8 1 8s2.5 5 7 5c1.5 0 2.8-.5 3.9-1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M8 3C5.5 3 3.5 4.2 2 5.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M10.5 3.8C12.5 5 15 8 15 8s-.7 1.5-2 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3C4 3 1 8 1 8s3 5 7 5 7-5 7-5-3-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', borderRadius: '10px', fontFamily: 'var(--font-display)' }}
            >
              {loading ? (
                <>
                  <span className="spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                  Authenticating...
                </>
              ) : 'Continue'}
            </button>
          </form>
        </div>

        {/* Trust signals */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
          {['256-bit SSL', 'Zero-knowledge', 'SOC 2 Type II'].map(label => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-3)' }}>
              <ShieldCheckIcon />
              {label}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-3)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
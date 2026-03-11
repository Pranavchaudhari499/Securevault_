import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(79,110,247,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(167,139,250,0.05) 0%, transparent 50%)' }} />
      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }} className="fade-in">
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '13px', color: 'var(--blue)', fontFamily: 'var(--mono)', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.05em' }}>SECUREVAULT</div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.5px' }}>Sign in</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>API Gateway Security System</p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '20px', color: 'var(--red)', fontSize: '13px' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500' }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="your@email.com" />
            </div>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500' }}>Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="Password" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '11px', fontSize: '14px' }}>
              {loading ? 'Authenticating...' : 'Continue'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-3)' }}>
          No account? <Link to="/register" style={{ color: 'var(--blue)', textDecoration: 'none' }}>Register</Link>
        </p>
        
      </div>
    </div>
    
  );
}
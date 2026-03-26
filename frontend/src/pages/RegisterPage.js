import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

function Field({ label, fieldKey, type = 'text', placeholder, maxLength, value, error, onChange, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.01em' }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(fieldKey, e.target.value)}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ borderColor: error ? 'var(--red)' : undefined, boxShadow: error ? '0 0 0 3px var(--red-dim)' : undefined }}
      />
      {error && (
        <div className="fade-in" style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 4v3M6 8.5v.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}
      {hint && !error && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

const roleConfig = {
  user: { label: 'User', desc: 'Initiate and track payments', icon: '👤', color: 'var(--blue)' },
  gateway_admin: { label: 'Gateway Admin', desc: 'Monitor & route transactions', icon: '🛡️', color: 'var(--purple)' },
  bank_officer: { label: 'Bank Officer', desc: 'Review and authorize payments', icon: '🏛️', color: 'var(--green)' },
};

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password || form.password.length < 6) e.password = 'Min 6 characters required';
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = 'Must be exactly 10 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      const data = await authAPI.register(form);
      localStorage.setItem('sv_token', data.token);
      if (form.role === 'gateway_admin') navigate('/gateway');
      else if (form.role === 'bank_officer') navigate('/bank');
      else navigate('/dashboard');
    } catch (err) { setApiError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const update = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };

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
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-15%', right: '-5%',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        }} />
        <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <defs>
            <pattern id="dots2" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots2)"/>
        </svg>
      </div>

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }} className="fade-in">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '0.12em', fontWeight: '500', marginBottom: '10px', textTransform: 'uppercase' }}>
            SecureVault
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.7px', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
            Create your account
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Join the secure payment network</p>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px', fontWeight: '500' }}>Select your role</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {Object.entries(roleConfig).map(([role, cfg]) => (
              <button
                key={role}
                type="button"
                onClick={() => update('role', role)}
                style={{
                  background: form.role === role ? `${cfg.color}14` : 'var(--bg-2)',
                  border: `1px solid ${form.role === role ? `${cfg.color}33` : 'var(--border)'}`,
                  borderRadius: '10px',
                  padding: '10px 8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{cfg.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: form.role === role ? cfg.color : 'var(--text-2)', marginBottom: '2px' }}>{cfg.label}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', lineHeight: 1.3 }}>{cfg.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.3)',
        }}>
          {apiError && (
            <div className="fade-in" style={{
              background: 'var(--red-dim)',
              border: '1px solid rgba(244,63,94,0.2)',
              borderRadius: '10px',
              padding: '11px 14px',
              marginBottom: '16px',
              color: 'var(--red)',
              fontSize: '13px',
            }}>{apiError}</div>
          )}

          <form onSubmit={handleSubmit}>
            <Field label="Full Name" fieldKey="name" placeholder="Jane Doe" value={form.name} error={errors.name} onChange={update} />
            <Field label="Email address" fieldKey="email" type="email" placeholder="you@example.com" value={form.email} error={errors.email} onChange={update} />
            <Field label="Password" fieldKey="password" type="password" placeholder="Min 6 characters" value={form.password} error={errors.password} onChange={update} />
            <Field label="Phone number" fieldKey="phone" placeholder="9876543210" maxLength={10} value={form.phone} error={errors.phone} onChange={update} hint="Optional · 10 digits" />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', borderRadius: '10px', marginTop: '6px', fontFamily: 'var(--font-display)' }}
            >
              {loading ? (
                <>
                  <span className="spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                  Creating account...
                </>
              ) : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-3)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
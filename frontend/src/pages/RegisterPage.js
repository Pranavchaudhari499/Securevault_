import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

function Field({ label, fieldKey, type = 'text', placeholder, maxLength, value, error, onChange }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(fieldKey, e.target.value)}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ borderColor: error ? 'var(--red)' : undefined }}
      />
      {error && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '3px' }}>{error}</div>}
    </div>
  );
}

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
    if (!form.password || form.password.length < 6) e.password = 'Min 6 characters';
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(79,110,247,0.05) 0%, transparent 60%)' }} />
      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }} className="fade-in">
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '13px', color: 'var(--blue)', fontFamily: 'var(--mono)', fontWeight: '500', marginBottom: '8px', letterSpacing: '0.05em' }}>SECUREVAULT</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>Create account</h1>
        </div>
        <div className="card" style={{ padding: '26px' }}>
          {apiError && <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--red)', fontSize: '13px' }}>{apiError}</div>}
          <form onSubmit={handleSubmit}>
            <Field label="Full Name" fieldKey="name" placeholder="Your full name" value={form.name} error={errors.name} onChange={update} />
            <Field label="Email" fieldKey="email" type="email" placeholder="your@email.com" value={form.email} error={errors.email} onChange={update} />
            <Field label="Password" fieldKey="password" type="password" placeholder="Min 6 characters" value={form.password} error={errors.password} onChange={update} />
            <Field label="Phone (10 digits)" fieldKey="phone" placeholder="9876543210" maxLength={10} value={form.phone} error={errors.phone} onChange={update} />
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>Role</label>
              <select value={form.role} onChange={e => update('role', e.target.value)}>
                <option value="user">User</option>
                <option value="gateway_admin">Gateway Admin</option>
                <option value="bank_officer">Bank Officer</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '11px', fontSize: '14px' }}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px', color: 'var(--text-3)' }}>
          Have account? <Link to="/login" style={{ color: 'var(--blue)', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
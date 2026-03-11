import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { gatewayAPI } from '../../services/api';

const riskBadge = (score) => score >= 60 ? 'red' : score >= 35 ? 'amber' : 'green';

export default function GatewayUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    try {
      const d = await gatewayAPI.getUsers();
      setUsers(d.users || []);
    } catch (e) {
      console.error('Users error:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleSuspend = async (userId) => {
    if (!reason.trim()) return;
    setActionLoading(userId);
    try { await gatewayAPI.suspendUser(userId, reason); setModal(null); setReason(''); await load(); }
    catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const handleUnsuspend = async (userId) => {
    setActionLoading(userId);
    try { await gatewayAPI.unsuspendUser(userId); await load(); }
    catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: '2px' }}>User Management</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>{filtered.length} users</p>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ width: '240px' }} />
        </div>

        {loading ? <div style={{ color: 'var(--text-3)', padding: '40px' }}>Loading...</div> : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>UPI / Account</th>
                  <th>Balance</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{u.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{u.email}</div>
                    </td>
                    <td style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                      <div>{u.upiId || '-'}</div>
                      <div>{u.accountNumber || '-'}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: '500' }}>Rs.{(u.balance || 0).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="risk-bar" style={{ width: '60px' }}>
                          <div className="risk-fill" style={{ width: `${u.riskScore || 0}%`, background: u.riskScore >= 60 ? 'var(--red)' : u.riskScore >= 35 ? 'var(--amber)' : 'var(--green)' }} />
                        </div>
                        <span className={`badge badge-${riskBadge(u.riskScore || 0)}`}>{u.riskScore || 0}</span>
                      </div>
                    </td>
                    <td>
                      {u.isSuspended
                        ? <span className="badge badge-red">SUSPENDED</span>
                        : <span className="badge badge-green">ACTIVE</span>}
                    </td>
                    <td>
                      {u.isSuspended ? (
                        <button className="btn btn-success" style={{ fontSize: '11px', padding: '5px 12px' }}
                          disabled={actionLoading === u._id}
                          onClick={() => handleUnsuspend(u._id)}>
                          {actionLoading === u._id ? '...' : 'Reactivate'}
                        </button>
                      ) : (
                        <button className="btn btn-danger" style={{ fontSize: '11px', padding: '5px 12px' }}
                          onClick={() => { setModal(u); setReason(''); }}>
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card fade-in" style={{ width: '420px', padding: '26px' }}>
            <h3 style={{ marginBottom: '6px' }}>Suspend Account</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '16px' }}>{modal.name} — {modal.email}</p>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500' }}>Reason <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Reason for suspension..." />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleSuspend(modal._id)}
                disabled={actionLoading === modal._id || !reason.trim()}>
                {actionLoading === modal._id ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
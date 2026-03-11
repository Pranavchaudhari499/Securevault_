import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI, transactionAPI } from '../../services/api';

const statusClass = { approved: 'green', rejected: 'red', flagged: 'amber', pending: 'blue', frozen: 'blue', blocked: 'red' };

export default function BankTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notes, setNotes] = useState('');
  const [modal, setModal] = useState(null);

  const load = () => transactionAPI.getAll({ limit: 50 }).then(d => setTransactions(d.transactions || [])).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handle = async (txId, action) => {
    setActionLoading(txId + action);
    try {
      if (action === 'approve') await bankAPI.approveTransaction(txId, notes);
      else await bankAPI.rejectTransaction(txId, notes);
      setModal(null); setNotes('');
      await load();
    } catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const pending = transactions.filter(t => t.bankDecision === 'pending' && t.gatewayDecision === 'review');

  return (
    <Layout>
      <div style={{ maxWidth: '1100px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '2px' }}>Transaction Review</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>{pending.length} pending review</p>
        </div>

        {pending.length > 0 && (
          <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--amber)' }}>
            {pending.length} transaction{pending.length > 1 ? 's' : ''} flagged by gateway — awaiting your decision
          </div>
        )}

        {loading ? <div style={{ color: 'var(--text-3)', padding: '40px' }}>Loading...</div> : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>User</th><th>Type</th><th>Amount</th><th>Risk</th><th>Gateway</th><th>Bank</th><th>Status</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx._id}>
                    <td>
                      <div style={{ fontWeight: '500', fontSize: '13px' }}>{tx.userId?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{tx.userId?.email}</div>
                    </td>
                    <td style={{ fontSize: '12px', textTransform: 'capitalize' }}>{tx.type?.replace(/_/g, ' ')}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: '600' }}>{tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '-'}</td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontWeight: '600', color: (tx.securityChecks?.overallRiskScore || 0) >= 60 ? 'var(--red)' : (tx.securityChecks?.overallRiskScore || 0) >= 30 ? 'var(--amber)' : 'var(--green)' }}>{tx.securityChecks?.overallRiskScore || 0}</span></td>
                    <td><span className={`badge badge-${tx.gatewayDecision === 'allow' ? 'green' : tx.gatewayDecision === 'block' ? 'red' : 'amber'}`}>{tx.gatewayDecision}</span></td>
                    <td><span className={`badge badge-${tx.bankDecision === 'approved' ? 'green' : tx.bankDecision === 'rejected' ? 'red' : 'blue'}`}>{tx.bankDecision}</span></td>
                    <td><span className={`badge badge-${statusClass[tx.status] || 'blue'}`}>{tx.status}</span></td>
                    <td style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                    <td>
                      {tx.bankDecision === 'pending' && tx.gatewayDecision === 'review' && (
                        <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={() => { setModal(tx); setNotes(''); }}>Review</button>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>No transactions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card fade-in" style={{ width: '480px', padding: '26px' }}>
            <h3 style={{ marginBottom: '6px' }}>Review Transaction</h3>
            <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-3)' }}>User</span><span style={{ fontWeight: '500' }}>{modal.userId?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-3)' }}>Amount</span><span style={{ fontFamily: 'var(--mono)', fontWeight: '600' }}>Rs.{modal.amount?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-3)' }}>Risk Score</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: '600' }}>{modal.securityChecks?.overallRiskScore}/100</span>
              </div>
            </div>
            {modal.securityChecks?.mlReasons?.length > 0 && (
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--purple)', fontWeight: '600', marginBottom: '4px' }}>ML Flag Reasons</div>
                {modal.securityChecks.mlReasons.map((r, i) => <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)' }}>- {r}</div>)}
              </div>
            )}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500' }}>Decision Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handle(modal._id, 'reject')}
                disabled={!!actionLoading}>Reject</button>
              <button className="btn btn-success" onClick={() => handle(modal._id, 'approve')}
                disabled={!!actionLoading}>{actionLoading ? 'Saving...' : 'Approve'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
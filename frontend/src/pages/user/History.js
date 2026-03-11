import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI } from '../../services/api';

const statusClass = { approved: 'green', blocked: 'red', flagged: 'amber', processing: 'blue', rejected: 'red', pending: 'blue', frozen: 'blue' };

export default function History() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    transactionAPI.getMy()
      .then(d => setTransactions(d.transactions || []))
      .catch(e => console.error('History error:', e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);

  return (
    <Layout>
      <div style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ marginBottom: '2px' }}>Transaction History</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>{filtered.length} transactions</p>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-2)', padding: '4px', borderRadius: 'var(--radius)' }}>
            {['all', 'approved', 'flagged', 'blocked', 'frozen'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ background: filter === s ? 'var(--bg-3)' : 'transparent', border: filter === s ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', padding: '5px 12px', color: filter === s ? 'var(--text)' : 'var(--text-3)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div style={{ color: 'var(--text-3)', padding: '40px' }}>Loading...</div> : (
          <div className="card">
            {filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No transactions found</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Recipient</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx._id}>
                      <td style={{ textTransform: 'capitalize', fontWeight: '500' }}>{tx.type.replace(/_/g, ' ')}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: '600', color: tx.amount > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                        {tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '-'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{tx.recipientUpi || tx.recipientAccount || '-'}</td>
                      <td>
                        <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: tx.securityChecks?.overallRiskScore >= 60 ? 'var(--red)' : tx.securityChecks?.overallRiskScore >= 30 ? 'var(--amber)' : 'var(--green)', fontWeight: '600' }}>
                          {tx.securityChecks?.overallRiskScore || 0}
                        </span>
                      </td>
                      <td><span className={`badge badge-${statusClass[tx.status] || 'blue'}`}>{tx.status}</span></td>
                      <td style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
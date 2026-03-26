import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI } from '../../services/api';

const statusConfig = {
  approved: { badge: 'badge-green', label: 'Approved', dot: 'var(--green)', icon: '✓' },
  blocked: { badge: 'badge-red', label: 'Blocked', dot: 'var(--red)', icon: '✗' },
  flagged: { badge: 'badge-amber', label: 'Flagged', dot: 'var(--amber)', icon: '⚠' },
  processing: { badge: 'badge-blue', label: 'Processing', dot: 'var(--blue)', icon: '○' },
  rejected: { badge: 'badge-red', label: 'Rejected', dot: 'var(--red)', icon: '✗' },
  pending: { badge: 'badge-blue', label: 'Pending', dot: 'var(--blue)', icon: '…' },
  frozen: { badge: 'badge-blue', label: 'Frozen', dot: 'var(--blue)', icon: '❄' },
};

const riskColor = (s) => s >= 60 ? 'var(--red)' : s >= 30 ? 'var(--amber)' : 'var(--green)';

const FILTERS = ['all', 'approved', 'flagged', 'blocked', 'frozen'];

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

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? transactions.length : transactions.filter(t => t.status === f).length;
    return acc;
  }, {});

  return (
    <Layout>
      <div style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Transaction History</h2>
              <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>{filtered.length} transactions {filter !== 'all' && `· filtered by ${filter}`}</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-2)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            width: 'fit-content',
            flexWrap: 'wrap',
          }}>
            {FILTERS.map(s => {
              const active = filter === s;
              const cfg = statusConfig[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    background: active ? 'var(--bg-card)' : 'transparent',
                    border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    color: active ? 'var(--text)' : 'var(--text-3)',
                    fontSize: '12px',
                    fontWeight: active ? '500' : '400',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    textTransform: 'capitalize',
                  }}
                >
                  {s !== 'all' && cfg && (
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: active ? cfg.dot : 'var(--text-4)', display: 'inline-block', flexShrink: 0 }} />
                  )}
                  {s}
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--mono)',
                    color: active ? 'var(--text-2)' : 'var(--text-4)',
                    background: active ? 'var(--bg-2)' : 'transparent',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}>{counts[s]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '68px', borderRadius: '12px' }} />)}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>No transactions found</div>
                <div style={{ fontSize: '12px' }}>Try changing the filter above</div>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Amount</th>
                    <th>Recipient</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx, i) => {
                    const cfg = statusConfig[tx.status] || statusConfig.pending;
                    return (
                      <tr key={tx._id} style={{ animation: `fadeUp 0.2s ease ${i * 0.03}s both` }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '30px', height: '30px',
                              borderRadius: '8px',
                              background: tx.status === 'approved' ? 'var(--green-dim)' : tx.status === 'blocked' || tx.status === 'rejected' ? 'var(--red-dim)' : 'var(--amber-dim)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: '700',
                              color: tx.status === 'approved' ? 'var(--green)' : tx.status === 'blocked' || tx.status === 'rejected' ? 'var(--red)' : 'var(--amber)',
                              flexShrink: 0, fontFamily: 'var(--mono)',
                            }}>{cfg.icon}</div>
                            <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{tx.type.replace(/_/g, ' ')}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--mono)',
                            fontWeight: '700',
                            letterSpacing: '-0.3px',
                            color: tx.amount > 0 ? 'var(--text)' : 'var(--text-3)',
                          }}>
                            {tx.amount > 0 ? `₹${tx.amount.toLocaleString()}` : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                            {tx.recipientUpi || tx.recipientAccount || '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                              width: '28px', height: '4px',
                              background: 'var(--bg-2)',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${tx.securityChecks?.overallRiskScore || 0}%`,
                                height: '100%',
                                background: riskColor(tx.securityChecks?.overallRiskScore || 0),
                                borderRadius: '2px',
                              }} />
                            </div>
                            <span style={{
                              fontSize: '12px',
                              fontFamily: 'var(--mono)',
                              fontWeight: '600',
                              color: riskColor(tx.securityChecks?.overallRiskScore || 0),
                            }}>{tx.securityChecks?.overallRiskScore || 0}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${cfg.badge}`}>{tx.status}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
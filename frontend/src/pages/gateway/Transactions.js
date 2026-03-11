import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { gatewayAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const statusColor = { approved: 'green', blocked: 'red', flagged: 'amber', pending: 'blue', frozen: 'purple' };
const riskColor = (s) => s >= 60 ? 'var(--red)' : s >= 30 ? 'var(--amber)' : 'var(--green)';

export default function GatewayTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [liveCount, setLiveCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await gatewayAPI.getLiveTransactions();
      setTransactions(d.transactions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    const s = getSocket();
    if (s) {
      s.on('transaction-update', (data) => {
        setLiveCount(p => p + 1);
        setTransactions(p => {
          const tx = data.transaction || data;
          const exists = p.find(t => t._id === tx._id);
          if (exists) return p.map(t => t._id === tx._id ? tx : t);
          return [tx, ...p].slice(0, 30);
        });
      });
    }
    return () => { clearInterval(iv); const s2 = getSocket(); if (s2) s2.off('transaction-update'); };
  }, [load]);

  return (
    <Layout>
      <div style={{ maxWidth: '1200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ marginBottom: '2px' }}>Live Transaction Stream</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>{transactions.length} recent · {liveCount} live events</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--green)', fontFamily: 'var(--mono)', background: 'var(--green-dim)', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="dot dot-green pulse" /> MONITORING ACTIVE
          </div>
        </div>

        <div className="card">
          {loading ? <div style={{ padding: '40px', color: 'var(--text-3)', textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Threat Flags</th>
                  <th>Device / IP</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <React.Fragment key={tx._id}>
                    <tr onClick={() => setSelected(selected === tx._id ? null : tx._id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: '500', fontSize: '13px' }}>{tx.userId?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{tx.userId?.email}</div>
                        {tx.userId?.riskScore > 0 && (
                          <div style={{ fontSize: '10px', color: riskColor(tx.userId.riskScore), fontFamily: 'var(--mono)' }}>User risk: {tx.userId.riskScore}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', textTransform: 'capitalize', color: 'var(--text-2)' }}>{tx.type?.replace(/_/g, ' ')}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: '600' }}>{tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '-'}</td>
                      <td><span className={`badge badge-${statusColor[tx.status] || 'blue'}`}>{tx.status}</span></td>
                      <td>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: '700', color: riskColor(tx.securityChecks?.overallRiskScore || 0), fontSize: '14px' }}>
                          {tx.securityChecks?.overallRiskScore || 0}
                        </span>
                      </td>
                      <td style={{ maxWidth: '160px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(tx.threatFlags || []).slice(0, 2).map(f => (
                            <span key={f} style={{ fontSize: '10px', background: 'var(--red-dim)', color: 'var(--red)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mono)' }}>{f.replace(/_/g, ' ')}</span>
                          ))}
                          {(tx.threatFlags || []).length > 2 && <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>+{tx.threatFlags.length - 2}</span>}
                          {(!tx.threatFlags || tx.threatFlags.length === 0) && <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                        <div>{tx.sessionData?.deviceId?.slice(0, 10) || '-'}</div>
                        <div>{tx.sessionData?.ipAddress || '-'}</div>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                    {selected === tx._id && (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--bg-2)', padding: '0' }}>
                          <div className="fade-in" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                              {/* ML Reasons */}
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>ML Detection</div>
                                {(tx.securityChecks?.mlReasons || []).map((r, i) => (
                                  <div key={i} style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '4px', display: 'flex', gap: '5px' }}><span>—</span>{r}</div>
                                ))}
                                {(!tx.securityChecks?.mlReasons?.length) && <div style={{ fontSize: '12px', color: 'var(--green)' }}>No anomalies detected</div>}
                                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)' }}>ML decision: <span style={{ color: tx.securityChecks?.mlDecision === 'anomaly' ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--mono)' }}>{tx.securityChecks?.mlDecision || 'unknown'}</span></div>
                              </div>

                              {/* Security checks */}
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Security Checks</div>
                                {['ipCheck', 'velocityCheck', 'amountCheck', 'behaviorCheck', 'deviceCheck', 'balanceCheck'].map(k => {
                                  const c = tx.securityChecks?.[k];
                                  if (!c) return null;
                                  return (
                                    <div key={k} style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '12px' }}>
                                      <span style={{ color: c.passed ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)', fontWeight: '700', width: '12px' }}>{c.passed ? '✓' : '✗'}</span>
                                      <span style={{ color: 'var(--text-3)', textTransform: 'capitalize' }}>{k.replace('Check', '')}</span>
                                      {c.details && <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>— {c.details}</span>}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Session */}
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Session Info</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.8 }}>
                                  <div>IP: <span style={{ fontFamily: 'var(--mono)' }}>{tx.sessionData?.ipAddress || '-'}</span></div>
                                  <div>Location: {tx.sessionData?.location || '-'}</div>
                                  <div>Device: <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{tx.sessionData?.deviceId?.slice(0, 16) || '-'}</span></div>
                                  {tx.sessionData?.isNewDevice && <span className="badge badge-red" style={{ fontSize: '10px', marginTop: '4px' }}>New Device</span>}
                                  {tx.sessionData?.impossibleTravel && <span className="badge badge-red" style={{ fontSize: '10px', marginLeft: '4px' }}>Impossible Travel</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>No transactions yet. Waiting for activity...</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
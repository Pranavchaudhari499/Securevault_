import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { gatewayAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const statusColor = { active: 'var(--green)', flagged: 'var(--amber)', blocked: 'var(--red)' };
const statusBadge = { active: 'green', flagged: 'amber', blocked: 'red' };

export default function GatewayDashboard() {
  const [data, setData] = useState(null);
  const [liveStream, setLiveStream] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await gatewayAPI.getDashboard();
      if (d) setData(d);
    } catch (e) { console.error('Gateway dashboard:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    const s = getSocket();
    if (s) {
      s.on('transaction-update', (tx) => {
        setLiveStream(p => [tx, ...p].slice(0, 20));
        load();
      });
      s.on('fraud-alert-update', load);
    }
    return () => { clearInterval(iv); const s2 = getSocket(); if (s2) { s2.off('transaction-update'); s2.off('fraud-alert-update'); } };
  }, [load]);

  if (loading) return <Layout><div style={{ padding: '40px', color: 'var(--text-3)' }}>Loading...</div></Layout>;
  const stats = data?.stats || {};

  return (
    <Layout>
      <div style={{ maxWidth: '1200px' }}>
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Users', value: stats.totalUsers || 0, color: 'var(--blue)' },
            { label: 'Flagged', value: stats.flaggedUsers || 0, color: 'var(--amber)' },
            { label: 'Blocked', value: stats.blockedUsers || 0, color: 'var(--red)' },
            { label: "Today's Transactions", value: stats.todayTx || 0, color: 'var(--purple)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color, fontFamily: 'var(--mono)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Fraud Trend */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Fraud Trend (7 Days)</h3>
            {(data?.fraudTrend || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.fraudTrend}>
                  <XAxis dataKey="_id" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="flagged" name="Flagged/Blocked" fill="var(--red)" radius={[3,3,0,0]} opacity={0.8} />
                  <Bar dataKey="total" name="Total" fill="var(--blue)" radius={[3,3,0,0]} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No data yet. Make some transactions.</div>}
          </div>

          {/* Recent Fraud Alerts */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h3>Recent Fraud Alerts</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                <span className="dot dot-green pulse" />LIVE
              </div>
            </div>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
              {(data?.recentAlerts || []).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No active alerts</div>
              ) : (data.recentAlerts).map(a => (
                <div key={a._id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{a.userId?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{a.userId?.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'var(--mono)', color: a.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)' }}>{a.fraudScore}</div>
                    <span className={`badge badge-${a.alertLevel === 'critical' || a.alertLevel === 'high' ? 'red' : 'amber'}`} style={{ fontSize: '10px' }}>{a.alertLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Live Transaction Stream */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h3>Live Transaction Stream</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                <span className="dot dot-green pulse" />LIVE
              </div>
            </div>
            <div style={{ maxHeight: '240px', overflow: 'auto' }}>
              {(data?.recentTransactions || []).map(tx => (
                <div key={tx._id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: tx.status === 'approved' ? 'var(--green)' : tx.status === 'blocked' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.userId?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{tx.type?.replace(/_/g, ' ')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', fontWeight: '600' }}>{tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '-'}</div>
                    <div style={{ fontSize: '10px', color: tx.securityChecks?.overallRiskScore >= 60 ? 'var(--red)' : tx.securityChecks?.overallRiskScore >= 30 ? 'var(--amber)' : 'var(--green)', fontFamily: 'var(--mono)' }}>
                      Risk: {tx.securityChecks?.overallRiskScore || 0}
                    </div>
                  </div>
                </div>
              ))}
              {(data?.recentTransactions || []).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No transactions yet</div>
              )}
            </div>
          </div>

          {/* Flagged Users */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3>Flagged Users</h3>
            </div>
            <div style={{ maxHeight: '240px', overflow: 'auto' }}>
              {(data?.flaggedUsersList || []).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No flagged users</div>
              ) : (data.flaggedUsersList).map(u => (
                <div key={u._id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{u.email}</div>
                    {u.velocity && <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{u.velocity.last5Min || 0}/5min · {u.velocity.last1Hour || 0}/hr</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{u.riskScore || 0}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{u.flaggedActivityCount || 0} incidents</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security layers */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '14px' }}>Active Security Layers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {['IP Fingerprinting', 'Velocity Detection (3/5min)', 'Isolation Forest ML', 'Replay Attack Prevention', 'Device Fingerprinting', 'Behavioral Biometrics', 'Amount Anomaly', 'Impossible Travel', 'Auto-Block (5 incidents)', 'Fraud Network Graph', 'Recipient Risk Scoring', 'Per-User Fraud Alert'].map(l => (
              <div key={l} style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="dot dot-green" /><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { gatewayAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const riskColor = (s) => s >= 60 ? 'var(--red)' : s >= 30 ? 'var(--amber)' : 'var(--green)';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ color: 'var(--text-3)', marginBottom: '6px', fontFamily: 'var(--mono)', fontSize: '10px' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color || 'var(--text)', fontFamily: 'var(--mono)', fontWeight: '600', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: p.color, display: 'inline-block' }} />
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, color, delta }) {
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden', transition: 'transform 0.15s ease' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: '500' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '800', color, fontFamily: 'var(--mono)', letterSpacing: '-1.5px', lineHeight: 1 }}>{value}</div>
      {delta != null && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '5px' }}>{delta}</div>}
    </div>
  );
}

export default function GatewayDashboard() {
  const [data, setData] = useState(null);
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
      s.on('transaction-update', load);
      s.on('fraud-alert-update', load);
    }
    return () => { clearInterval(iv); const s2 = getSocket(); if (s2) { s2.off('transaction-update'); s2.off('fraud-alert-update'); } };
  }, [load]);

  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1200px' }}>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }} />)}
          </div>
          <div className="grid-2" style={{ marginBottom: '24px' }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '16px' }} />)}
          </div>
        </div>
      </Layout>
    );
  }

  const stats = data?.stats || {};

  return (
    <Layout>
      <div style={{ maxWidth: '1200px' }}>
        {/* Page header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>Gateway Overview</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', padding: '3px 9px', borderRadius: '20px' }}>
              <span className="dot dot-green pulse" style={{ width: '5px', height: '5px' }} />
              LIVE
            </div>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Real-time transaction monitoring and fraud detection</p>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          <StatCard label="Total Users" value={stats.totalUsers || 0} color="var(--blue)" />
          <StatCard label="Flagged Users" value={stats.flaggedUsers || 0} color="var(--amber)" delta={`${Math.round(((stats.flaggedUsers || 0) / Math.max(stats.totalUsers || 1, 1)) * 100)}% of total`} />
          <StatCard label="Blocked Users" value={stats.blockedUsers || 0} color="var(--red)" />
          <StatCard label="Today's Volume" value={stats.todayTx || 0} color="var(--purple)" delta="Transactions" />
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Fraud trend chart */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Fraud Trend</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>7 days</span>
            </div>
            {(data?.fraudTrend || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data.fraudTrend} barGap={2}>
                  <XAxis dataKey="_id" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" fill="var(--blue)" radius={[4,4,0,0]} opacity={0.25} />
                  <Bar dataKey="flagged" name="Flagged" fill="var(--red)" radius={[4,4,0,0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '13px', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '24px' }}>📊</div>
                No data yet
              </div>
            )}
          </div>

          {/* Recent alerts */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Active Fraud Alerts</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--mono)' }}>
                <span className="dot dot-red pulse" />
                {(data?.recentAlerts || []).length} active
              </div>
            </div>
            <div style={{ maxHeight: '190px', overflow: 'auto' }}>
              {(data?.recentAlerts || []).length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>✅</div>
                  No active alerts
                </div>
              ) : data.recentAlerts.map(a => (
                <div key={a._id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '1px' }}>{a.userId?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{a.userId?.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--mono)', color: a.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)', letterSpacing: '-0.5px' }}>{a.fraudScore}</div>
                    <span className={`badge badge-${a.alertLevel === 'critical' || a.alertLevel === 'high' ? 'red' : 'amber'}`} style={{ fontSize: '10px' }}>{a.alertLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Live transactions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Live Transactions</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                <span className="dot dot-green pulse" />LIVE
              </div>
            </div>
            <div style={{ maxHeight: '260px', overflow: 'auto' }}>
              {(data?.recentTransactions || []).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>⏳</div>
                  Waiting for transactions
                </div>
              ) : (data.recentTransactions).map(tx => (
                <div key={tx._id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: tx.status === 'approved' ? 'var(--green)' : tx.status === 'blocked' ? 'var(--red)' : 'var(--amber)',
                    boxShadow: `0 0 6px ${tx.status === 'approved' ? 'var(--green)' : tx.status === 'blocked' ? 'var(--red)' : 'var(--amber)'}`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.userId?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{tx.type?.replace(/_/g, ' ')}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', fontWeight: '700', letterSpacing: '-0.3px' }}>{tx.amount > 0 ? `₹${tx.amount.toLocaleString()}` : '-'}</div>
                    <div style={{ fontSize: '10px', color: riskColor(tx.securityChecks?.overallRiskScore || 0), fontFamily: 'var(--mono)' }}>
                      Risk: {tx.securityChecks?.overallRiskScore || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flagged users */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Flagged Users</h3>
              <span className="badge badge-amber" style={{ fontSize: '10px' }}>{(data?.flaggedUsersList || []).length}</span>
            </div>
            <div style={{ maxHeight: '260px', overflow: 'auto' }}>
              {(data?.flaggedUsersList || []).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>✅</div>
                  No flagged users
                </div>
              ) : data.flaggedUsersList.map(u => (
                <div key={u._id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px',
                    background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '700', color: 'var(--amber)',
                    fontFamily: 'var(--font-display)', flexShrink: 0,
                  }}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{u.email}</div>
                    {u.velocity && <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{u.velocity.last5Min || 0}/5min · {u.velocity.last1Hour || 0}/hr</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--mono)', color: 'var(--amber)', letterSpacing: '-0.5px' }}>{u.riskScore || 0}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{u.flaggedActivityCount || 0} flags</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security layers */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>Active Security Layers</h3>
            <div className="trust-badge">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 3.5v4.2C2 10.4 4.5 13 7 13.5c2.5-.5 5-3.1 5-5.8V3.5L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M4.5 7l2 2L10 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              All layers active
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
            {[
              'IP Fingerprinting',
              'Velocity Detection (3/5min)',
              'Isolation Forest ML',
              'Replay Attack Prevention',
              'Device Fingerprinting',
              'Behavioral Biometrics',
              'Amount Anomaly',
              'Impossible Travel',
              'Auto-Block (5 incidents)',
              'Fraud Network Graph',
              'Recipient Risk Scoring',
              'Per-User Fraud Alert',
            ].map((l, i) => (
              <div key={l} style={{
                padding: '9px 12px',
                background: 'var(--bg-2)',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span className="dot dot-green pulse" style={{ width: '5px', height: '5px', animationDelay: `${i * 0.1}s` }} />
                <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
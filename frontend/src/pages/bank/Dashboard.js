import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const riskColor = (s) => s >= 60 ? 'var(--red)' : s >= 30 ? 'var(--amber)' : 'var(--green)';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ color: 'var(--text-3)', marginBottom: '4px', fontFamily: 'var(--mono)', fontSize: '10px' }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontFamily: 'var(--mono)', fontWeight: '600' }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  }
  return null;
};

export default function BankDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await bankAPI.getDashboard();
      if (d) setData(d);
    } catch (e) { console.error('Bank dashboard:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    const s = getSocket();
    if (s) {
      s.on('fraud-alert-update', load);
      s.on('transaction-update', load);
    }
    return () => { clearInterval(iv); const s2 = getSocket(); if (s2) { s2.off('fraud-alert-update'); s2.off('transaction-update'); } };
  }, [load]);

  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1200px' }}>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }} />)}
          </div>
          <div className="grid-2">
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '260px', borderRadius: '16px' }} />)}
          </div>
        </div>
      </Layout>
    );
  }

  const stats = data?.stats || {};
  const pendingReview = stats.pendingReview || 0;

  return (
    <Layout>
      <div style={{ maxWidth: '1200px' }}>
        {/* Page header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>Bank Control Center</h2>
              {pendingReview > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.2)',
                  padding: '3px 9px', borderRadius: '20px',
                  fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--mono)',
                }}>
                  <span className="dot dot-red pulse" style={{ width: '5px', height: '5px' }} />
                  {pendingReview} PENDING
                </div>
              )}
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Authorization, fraud review, and account management</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Accounts', value: stats.totalUsers || 0, color: 'var(--blue)' },
            { label: 'Pending Review', value: pendingReview, color: pendingReview > 0 ? 'var(--amber)' : 'var(--green)' },
            { label: 'Fraud Alerts', value: stats.fraudAlerts || 0, color: 'var(--red)' },
            { label: 'Approved Today', value: stats.approvedToday || 0, color: 'var(--green)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: '500' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color, fontFamily: 'var(--mono)', letterSpacing: '-1.5px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Fraud alerts */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Critical Fraud Alerts</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                <span className="dot dot-green pulse" />LIVE
              </div>
            </div>
            <div style={{ maxHeight: '280px', overflow: 'auto' }}>
              {(data?.recentAlerts || []).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>✅</div>
                  No critical alerts
                </div>
              ) : (data.recentAlerts).map(a => (
                <div key={a._id} style={{
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${a.alertLevel === 'critical' || a.alertLevel === 'high' ? 'var(--red)' : 'var(--amber)'}`,
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{a.userId?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{a.userId?.email}</div>
                      {a.fraudReason && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.4 }}>{a.fraudReason}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--mono)', color: a.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)', letterSpacing: '-0.5px' }}>{a.fraudScore}</div>
                      <span className={`badge badge-${a.alertLevel === 'critical' || a.alertLevel === 'high' ? 'red' : 'amber'}`} style={{ fontSize: '10px' }}>{a.alertLevel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions requiring review */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Pending Authorization</h3>
              {pendingReview > 0 && <span className="badge badge-red">{pendingReview} waiting</span>}
            </div>
            <div style={{ maxHeight: '280px', overflow: 'auto' }}>
              {(data?.pendingTransactions || []).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>🔍</div>
                  No pending reviews
                </div>
              ) : (data.pendingTransactions || []).map(tx => (
                <div key={tx._id} style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>{tx.userId?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{tx.type?.replace(/_/g, ' ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'var(--mono)' }}>₹{tx.amount?.toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: riskColor(tx.securityChecks?.overallRiskScore || 0), fontFamily: 'var(--mono)' }}>
                        Risk: {tx.securityChecks?.overallRiskScore || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction volume chart */}
        {(data?.volumeTrend || []).length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Transaction Volume</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>7 days</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data.volumeTrend}>
                <XAxis dataKey="_id" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="approved" name="Approved" fill="var(--green)" radius={[4,4,0,0]} opacity={0.8} />
                <Bar dataKey="rejected" name="Rejected" fill="var(--red)" radius={[4,4,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Quick actions */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '14px' }}>Quick Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Review Transactions', icon: '🔍', href: '/bank/transactions', color: 'var(--blue)' },
              { label: 'Fraud Alert Center', icon: '🚨', href: '/bank/fraud-alerts', color: 'var(--red)' },
              { label: 'Network Analysis', icon: '🕸️', href: '/bank/network-graph', color: 'var(--purple)' },
            ].map(action => (
              <a key={action.label} href={action.href} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px',
                background: 'var(--bg-2)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${action.color}33`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
              >
                <div style={{ fontSize: '20px' }}>{action.icon}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{action.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>→ Navigate</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
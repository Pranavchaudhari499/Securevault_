import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ─────────────────────────────────────────
   Design tokens — override your CSS vars
   ───────────────────────────────────────── */
const tokens = `
  :root {
    --vault-gold:      #C9A84C;
    --vault-gold-soft: rgba(201,168,76,0.12);
    --vault-gold-line: rgba(201,168,76,0.25);
    --vault-navy:      #1A1F2E;
    --vault-slate:     #64748B;
    --vault-border:    rgba(15,23,42,0.08);
    --vault-shadow:    0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.04);
    --vault-shadow-lg: 0 4px 6px rgba(15,23,42,0.04), 0 20px 60px rgba(15,23,42,0.08);
    --vault-radius:    16px;
    --vault-red:       #DC2626;
    --vault-red-soft:  rgba(220,38,38,0.08);
    --vault-green:     #059669;
    --vault-green-soft:rgba(5,150,105,0.08);
    --vault-amber:     #D97706;
    --vault-amber-soft:rgba(217,119,6,0.08);
  }
`;

const injectTokens = () => {
  if (typeof document !== 'undefined' && !document.getElementById('vault-tokens')) {
    const s = document.createElement('style');
    s.id = 'vault-tokens';
    s.textContent = tokens;
    document.head.appendChild(s);
  }
};

/* ─── Helpers ─── */
const riskColor = (s) =>
  s >= 60 ? 'var(--vault-red)' : s >= 30 ? 'var(--vault-amber)' : 'var(--vault-green)';

const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/* ─── Custom chart tooltip ─── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--vault-border)',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: 'var(--vault-shadow)',
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--vault-slate)', marginBottom: '6px', fontSize: '11px', letterSpacing: '0.04em' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

/* ─── Stat card ─── */
function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--vault-border)',
      borderRadius: 'var(--vault-radius)',
      padding: '22px 24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'var(--vault-shadow)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--vault-shadow-lg)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--vault-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${accent}, transparent)`,
      }} />
      {/* soft bg glow */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
        borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(20px)',
      }} />
      <div style={{ fontSize: '10px', color: 'var(--vault-slate)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '12px' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--vault-navy)', letterSpacing: '-1.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--vault-slate)', marginTop: '8px' }}>{sub}</div>}
    </div>
  );
}

/* ─── Alert row ─── */
function AlertRow({ alert }) {
  const isHigh = alert.alertLevel === 'critical' || alert.alertLevel === 'high';
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid var(--vault-border)',
      borderLeft: `3px solid ${isHigh ? 'var(--vault-red)' : 'var(--vault-amber)'}`,
      transition: 'background 0.15s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--vault-navy)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {alert.userId?.name || 'Unknown Account'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vault-slate)', fontFamily: 'monospace', marginBottom: alert.fraudReason ? '5px' : 0 }}>
            {alert.userId?.email}
          </div>
          {alert.fraudReason && (
            <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>{alert.fraudReason}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: '22px', fontWeight: '800', color: isHigh ? 'var(--vault-red)' : 'var(--vault-amber)',
            letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{alert.fraudScore}</div>
          <div style={{
            fontSize: '10px', marginTop: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em',
            color: isHigh ? 'var(--vault-red)' : 'var(--vault-amber)',
          }}>{alert.alertLevel}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending tx row ─── */
function TxRow({ tx }) {
  const score = tx.securityChecks?.overallRiskScore || 0;
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid var(--vault-border)',
      transition: 'background 0.15s ease',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--vault-navy)', marginBottom: '2px' }}>
            {tx.userId?.name || 'Unknown'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vault-slate)', textTransform: 'capitalize' }}>
            {tx.type?.replace(/_/g, ' ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--vault-navy)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(tx.amount)}
          </div>
          <div style={{ fontSize: '10px', color: riskColor(score), fontWeight: '600', marginTop: '3px' }}>
            Risk {score}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section card wrapper ─── */
function SectionCard({ title, badge, live, children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--vault-border)',
      borderRadius: 'var(--vault-radius)',
      boxShadow: 'var(--vault-shadow)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--vault-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--vault-navy)', letterSpacing: '-0.2px' }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {badge && (
            <span style={{
              fontSize: '10px', fontWeight: '700', padding: '3px 8px',
              borderRadius: '20px', background: 'var(--vault-red-soft)',
              color: 'var(--vault-red)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{badge}</span>
          )}
          {live && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--vault-green)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: 'var(--vault-green)',
                animation: 'vaultPulse 2s ease-in-out infinite',
              }} />
              Live
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ icon, message }) {
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center' }}>
      <div style={{
        width: '40px', height: '40px', margin: '0 auto 12px',
        borderRadius: '12px', background: 'rgba(15,23,42,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--vault-slate)" strokeWidth="1.5">
          {icon}
        </svg>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--vault-slate)' }}>{message}</div>
    </div>
  );
}

/* ─── Skeleton loader ─── */
function Skeleton({ height, radius = '12px', style = {} }) {
  return (
    <div style={{
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'vaultShimmer 1.6s ease-in-out infinite',
      ...style,
    }} />
  );
}

/* ─── Quick action ─── */
function QuickAction({ label, desc, href, icon, color }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '16px 18px',
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid var(--vault-border)',
      textDecoration: 'none',
      transition: 'all 0.18s ease',
      boxShadow: 'var(--vault-shadow)',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.boxShadow = `0 4px 20px ${color}18`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--vault-border)';
        e.currentTarget.style.boxShadow = 'var(--vault-shadow)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
          {icon}
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--vault-navy)', marginBottom: '1px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--vault-slate)' }}>{desc}</div>
      </div>
      <div style={{ marginLeft: 'auto', color: 'var(--vault-slate)', opacity: 0.5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </a>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function BankDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  injectTokens();

  const load = useCallback(async () => {
    try {
      const d = await bankAPI.getDashboard();
      if (d) setData(d);
    } catch (e) { console.error('Dashboard load:', e); }
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
    return () => {
      clearInterval(iv);
      const s2 = getSocket();
      if (s2) { s2.off('fraud-alert-update'); s2.off('transaction-update'); }
    };
  }, [load]);

  /* ── Animations ── */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('vault-anim')) return;
    const s = document.createElement('style');
    s.id = 'vault-anim';
    s.textContent = `
      @keyframes vaultShimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      @keyframes vaultPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%     { opacity:0.5; transform:scale(0.8); }
      }
      @keyframes vaultFadeUp {
        from { opacity:0; transform:translateY(12px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .vault-fadein { animation: vaultFadeUp 0.4s ease both; }
    `;
    document.head.appendChild(s);
  }, []);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1200px', padding: '0 4px' }}>
          <div style={{ marginBottom: '28px' }}>
            <Skeleton height="28px" style={{ width: '260px', marginBottom: '8px' }} />
            <Skeleton height="14px" style={{ width: '180px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
            {[1,2,3,4].map(i => <Skeleton key={i} height="100px" />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[1,2].map(i => <Skeleton key={i} height="280px" />)}
          </div>
          <Skeleton height="180px" />
        </div>
      </Layout>
    );
  }

  const stats          = data?.stats || {};
  const pendingReview  = stats.pendingReview || 0;
  const fraudAlerts    = stats.fraudAlerts   || 0;

  return (
    <Layout>
      <div style={{ maxWidth: '1200px', padding: '0 4px' }} className="vault-fadein">

        {/* ── Page header ── */}
        <div style={{
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h2 style={{
                fontSize: '22px',
                fontWeight: '700',
                color: 'var(--vault-navy)',
                letterSpacing: '-0.5px',
              }}>Control Centre</h2>

              {pendingReview > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: '700', padding: '3px 10px',
                  borderRadius: '20px', background: 'var(--vault-red-soft)',
                  color: 'var(--vault-red)', textTransform: 'uppercase', letterSpacing: '0.07em',
                  border: '1px solid rgba(220,38,38,0.15)',
                }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%', background: 'var(--vault-red)',
                    animation: 'vaultPulse 1.8s ease-in-out infinite',
                  }} />
                  {pendingReview} Pending
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--vault-slate)' }}>
              Authorization, fraud review, and account management
            </p>
          </div>

          {/* trust badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            fontSize: '11px', color: 'var(--vault-slate)',
            padding: '8px 14px', borderRadius: '10px',
            background: '#fff', border: '1px solid var(--vault-border)',
            boxShadow: 'var(--vault-shadow)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--vault-gold)" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Secured by Vault Gateway</span>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <StatCard label="Total Accounts"   value={stats.totalUsers   || 0} accent="#3B82F6" sub="Active accounts" />
          <StatCard label="Pending Review"   value={pendingReview}           accent={pendingReview > 0 ? 'var(--vault-amber)' : 'var(--vault-green)'} sub="Awaiting decision" />
          <StatCard label="Fraud Alerts"     value={fraudAlerts}             accent="var(--vault-red)"   sub={fraudAlerts > 0 ? 'Requires attention' : 'All clear'} />
          <StatCard label="Approved Today"   value={stats.approvedToday || 0} accent="var(--vault-green)" sub="Processed today" />
        </div>

        {/* ── Alerts + Pending ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          <SectionCard title="Fraud Alerts" live>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {(data?.recentAlerts || []).length === 0
                ? <EmptyState icon={<><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></>} message="No active fraud alerts" />
                : data.recentAlerts.map(a => <AlertRow key={a._id} alert={a} />)
              }
            </div>
          </SectionCard>

          <SectionCard
            title="Pending Authorization"
            badge={pendingReview > 0 ? `${pendingReview} waiting` : null}
          >
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {(data?.pendingTransactions || []).length === 0
                ? <EmptyState icon={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>} message="No pending reviews" />
                : (data.pendingTransactions || []).map(tx => <TxRow key={tx._id} tx={tx} />)
              }
            </div>
          </SectionCard>
        </div>

        {/* ── Volume chart ── */}
        {(data?.volumeTrend || []).length > 0 && (
          <div style={{
            background: '#fff',
            border: '1px solid var(--vault-border)',
            borderRadius: 'var(--vault-radius)',
            boxShadow: 'var(--vault-shadow)',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--vault-navy)', marginBottom: '2px' }}>Transaction Volume</h3>
                <p style={{ fontSize: '11px', color: 'var(--vault-slate)' }}>Past 7 days</p>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                {[
                  { color: 'var(--vault-green)', label: 'Approved' },
                  { color: 'var(--vault-red)',   label: 'Rejected' },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--vault-slate)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.volumeTrend} barSize={14} barGap={4}>
                <XAxis dataKey="_id" tick={{ fill: 'var(--vault-slate)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--vault-slate)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.03)' }} />
                <Bar dataKey="approved" name="Approved" fill="var(--vault-green)" radius={[4,4,0,0]} opacity={0.85} />
                <Bar dataKey="rejected" name="Rejected" fill="var(--vault-red)"   radius={[4,4,0,0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--vault-border)',
          borderRadius: 'var(--vault-radius)',
          boxShadow: 'var(--vault-shadow)',
          padding: '20px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--vault-navy)', marginBottom: '14px' }}>Quick Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            <QuickAction
              label="Review Transactions"
              desc="Authorize or reject pending"
              href="/bank/transactions"
              color="#3B82F6"
              icon={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>}
            />
            <QuickAction
              label="Fraud Alert Centre"
              desc="Monitor and act on alerts"
              href="/bank/fraud-alerts"
              color="var(--vault-red)"
              icon={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
            />
            <QuickAction
              label="Network Analysis"
              desc="Visualise account relationships"
              href="/bank/network-graph"
              color="var(--vault-gold)"
              icon={<><circle cx="12" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><circle cx="5" cy="19" r="3"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="13" x2="19" y2="16"/><line x1="12" y1="13" x2="5" y2="16"/></>}
            />
          </div>
        </div>

      </div>
    </Layout>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { useAuth } from '../../context/AuthContext';
import { userAPI, transactionAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ─── Design tokens (override global vars for white theme) ──────────────── */
const T = {
  text:    '#0a0a0a',
  text2:   '#3d3d3d',
  text3:   '#6b6b6b',
  text4:   '#a3a3a3',
  border:  '#e8e8e8',
  border2: '#d4d4d4',
  bg:      '#ffffff',
  bg2:     '#f7f7f7',
  bg3:     '#f0f0f0',
  bgHov:   '#fafafa',
  green:   '#059669',
  greenDim:'#ecfdf5',
  amber:   '#d97706',
  amberDim:'#fffbeb',
  red:     '#dc2626',
  redDim:  '#fef2f2',
  blue:    '#2563eb',
  blueDim: '#eff6ff',
  shadow:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd:'0 4px 16px rgba(0,0,0,0.07)',
  radius:  '12px',
  mono:    '"DM Mono", "Roboto Mono", monospace',
};

/* ─── Keyframes injected once ───────────────────────────────────────────── */
const STYLES = `
@keyframes fadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes shimmer  { from { background-position:-200% 0 } to { background-position:200% 0 } }
@keyframes pulse    { 0%,100% { opacity:.4 } 50% { opacity:1 } }
@keyframes flowDot  { 0%,100%{opacity:.2} 50%{opacity:1} }
@keyframes scaleIn  { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
@keyframes spin     { to { transform:rotate(360deg) } }
`;
if (!document.getElementById('sv-styles')) {
  const s = document.createElement('style');
  s.id = 'sv-styles';
  s.textContent = STYLES;
  document.head.appendChild(s);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const riskColor = (s) =>
  s >= 60 ? T.red : s >= 30 ? T.amber : T.green;

const statusMeta = {
  approved:   { color: T.green,  bg: T.greenDim, label: 'Approved',   dot: T.green  },
  blocked:    { color: T.red,    bg: T.redDim,   label: 'Blocked',    dot: T.red    },
  flagged:    { color: T.amber,  bg: T.amberDim, label: 'Flagged',    dot: T.amber  },
  processing: { color: T.blue,   bg: T.blueDim,  label: 'Processing', dot: T.blue   },
  rejected:   { color: T.red,    bg: T.redDim,   label: 'Rejected',   dot: T.red    },
  pending:    { color: T.blue,   bg: T.blueDim,  label: 'Pending',    dot: T.blue   },
  frozen:     { color: T.blue,   bg: T.blueDim,  label: 'Frozen',     dot: T.blue   },
};

const statusIcon = {
  approved: '+', blocked: 'x', flagged: '!',
  processing: 'o', rejected: 'x', pending: '.', frozen: '#',
};

/* ─── Sub-components ────────────────────────────────────────────────────── */
function Skeleton({ h = 80, r = 12 }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
    }} />
  );
}

function StatCard({ label, value, sub, color, index }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.bg,
        border: `1px solid ${hov ? T.border2 : T.border}`,
        borderRadius: T.radius,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        animation: `fadeUp 0.35s cubic-bezier(.22,1,.36,1) ${index * 0.07}s both`,
        boxShadow: hov ? T.shadowMd : T.shadow,
        transition: 'box-shadow .2s ease, border-color .2s ease, transform .2s ease',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        cursor: 'default',
      }}
    >
      {/* top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: color, opacity: .7,
        transition: 'opacity .2s',
      }} />

      <div style={{
        fontSize: '10px', color: T.text4, marginBottom: '12px',
        textTransform: 'uppercase', letterSpacing: '0.09em',
        fontFamily: T.mono, fontWeight: '500',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '26px', fontWeight: '700', color: T.text,
        fontFamily: T.mono, letterSpacing: '-1.5px', lineHeight: 1,
      }}>
        <span style={{ color }}>{value}</span>
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: T.text3, marginTop: '6px' }}>{sub}</div>
      )}
    </div>
  );
}

function FlowBadge({ status }) {
  const steps = [
    { label: 'User',    done: true },
    { label: 'Gateway', done: status !== 'processing' },
    { label: 'Bank',    done: status === 'approved' || status === 'rejected' || status === 'blocked' },
  ];
  const col = (i) => {
    if (!steps[i].done) return T.text4;
    if (status === 'blocked' || status === 'rejected') return i === 2 ? T.red : T.green;
    if (status === 'flagged') return i === 1 ? T.amber : i === 0 ? T.green : T.text4;
    return T.green;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '6px',
              background: steps[i].done ? `${col(i)}14` : T.bg2,
              border: `1px solid ${steps[i].done ? `${col(i)}33` : T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: '700', color: col(i), fontFamily: T.mono,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '7px', color: col(i), fontFamily: T.mono, fontWeight: '500' }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', gap: '2px', paddingBottom: '12px', alignItems: 'center' }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{
                  width: '4px', height: '1.5px', borderRadius: '1px',
                  background: steps[i].done ? col(i) : T.border,
                  opacity: steps[i].done ? 0.7 : 0.3,
                  animation: steps[i].done ? `flowDot 1.2s ease ${d * 0.3}s infinite` : 'none',
                }} />
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Badge({ status }) {
  const m = statusMeta[status] || statusMeta.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '10px', fontWeight: '500', fontFamily: T.mono,
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}22`,
      borderRadius: '5px', padding: '2px 7px',
      textTransform: 'capitalize', letterSpacing: '.02em',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.dot }} />
      {status}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: '8px', padding: '10px 14px',
      boxShadow: T.shadowMd,
    }}>
      <div style={{ color: T.text3, marginBottom: '3px', fontFamily: T.mono, fontSize: '10px' }}>{label}</div>
      <div style={{ color: T.blue, fontWeight: '600', fontFamily: T.mono, fontSize: '13px' }}>
        Rs.{payload[0].value?.toLocaleString()}
      </div>
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function UserDashboard() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMsg, setTopUpMsg] = useState('');

  const load = useCallback(() => {
    Promise.all([userAPI.getProfile(), transactionAPI.getMy()])
      .then(([pd, td]) => {
        if (pd?.user) {
          setProfile(pd.user);
          updateUser({ balance: pd.user.balance, riskScore: pd.user.riskScore, riskLevel: pd.user.riskLevel });
        }
        if (td?.transactions) setTxns(td.transactions);
      })
      .catch(e => console.error('Dashboard error:', e))
      .finally(() => setLoading(false));
  }, [updateUser]);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (socket) {
      socket.on('transaction-result', load);
      socket.on('account-suspended', load);
      socket.on('account-blocked', load);
      socket.on('notification', load);
      return () => {
        socket.off('transaction-result', load);
        socket.off('account-suspended', load);
        socket.off('account-blocked', load);
        socket.off('notification', load);
      };
    }
  }, [load]);

  const handleTopUp = async () => {
    if (!topUpAmount || isNaN(topUpAmount)) return;
    setTopUpLoading(true); setTopUpMsg('');
    try {
      await transactionAPI.topUp({ amount: topUpAmount });
      setTopUpMsg(`Rs.${topUpAmount} added successfully`);
      setTopUpAmount('');
      load();
    } catch (e) { setTopUpMsg(e.message || 'Failed'); }
    setTopUpLoading(false);
  };

  const chartData = txns
    .filter(t => t.status === 'approved' && t.amount > 0)
    .slice(-12)
    .map(t => ({
      name: new Date(t.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      amount: t.amount,
    }));

  /* ── Loading skeleton ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '960px', padding: '0 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {[1,2,3,4].map(i => <Skeleton key={i} h={90} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', marginBottom: '20px' }}>
            <Skeleton h={160} /><Skeleton h={160} />
          </div>
          <Skeleton h={280} />
        </div>
      </Layout>
    );
  }

  const riskLevel = profile?.riskLevel || user?.riskLevel || 'low';
  const riskScore = profile?.riskScore ?? user?.riskScore ?? 0;
  const balance   = profile?.balance   ?? user?.balance   ?? 0;

  /* ── UI ───────────────────────────────────────────────────────────────── */
  return (
    <Layout>
      <div style={{ maxWidth: '960px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '28px', animation: 'fadeUp .3s ease both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{
                fontSize: '22px', fontWeight: '600', color: T.text,
                letterSpacing: '-0.4px', marginBottom: '2px',
              }}>
                Overview
              </h2>
              <p style={{ fontSize: '13px', color: T.text3 }}>
                Welcome back, {profile?.name || user?.name || 'User'}
              </p>
            </div>

            {/* Security status pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: '99px', padding: '6px 14px',
              fontSize: '12px', color: T.text3,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontFamily: T.mono, fontWeight: '500', color: T.text2 }}>Secured by Vault Gateway</span>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <StatCard
            index={0} label="Available Balance"
            value={`Rs.${balance.toLocaleString()}`}
            sub="Accessible funds"
            color={T.blue}
          />
          <StatCard
            index={1} label="Risk Score"
            value={riskScore}
            sub={`Level: ${riskLevel}`}
            color={riskColor(riskScore)}
          />
          <StatCard
            index={2} label="Transactions"
            value={txns.length}
            sub={`${txns.filter(t => t.status === 'approved').length} approved`}
            color={T.green}
          />
          <StatCard
            index={3} label="Blocked"
            value={txns.filter(t => t.status === 'blocked' || t.status === 'rejected').length}
            sub="Fraud prevented"
            color={T.red}
          />
        </div>

        {/* ── Middle row: frozen alert + topup/flow ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', marginBottom: '20px' }}>

          {/* Account status */}
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: '20px 22px',
            boxShadow: T.shadow,
            animation: 'fadeUp .4s ease .15s both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: T.text2 }}>Account Status</span>
              <Badge status={profile?.status || 'active'} />
            </div>

            {/* UPI ID */}
            {(profile?.upiId || user?.upiId) && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: T.blueDim, border: `1px solid ${T.blue}18`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" style={{ flexShrink: 0 }}>
                    <rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>UPI ID</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: T.blue, fontFamily: T.mono, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile?.upiId || user?.upiId}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(profile?.upiId || user?.upiId); }}
                  title="Copy UPI ID"
                  style={{
                    background: 'none', border: `1px solid ${T.blue}22`, borderRadius: '6px',
                    padding: '4px 8px', cursor: 'pointer', color: T.blue, fontSize: '10px',
                    fontFamily: T.mono, fontWeight: '500', transition: 'all .15s',
                    display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.blue}12`; e.currentTarget.style.borderColor = `${T.blue}44`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = `${T.blue}22`; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
              </div>
            )}

            {profile?.frozenBalance > 0 && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: T.amberDim, border: `1px solid ${T.amber}22`,
                borderRadius: '8px', padding: '12px 14px', marginBottom: '14px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: T.amber, marginBottom: '2px' }}>Funds Frozen</div>
                  <div style={{ fontSize: '11px', color: T.text3 }}>
                    Rs.{profile.frozenBalance.toLocaleString()} pending gateway review
                  </div>
                </div>
              </div>
            )}

            {profile?.isSuspended && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: T.redDim, border: `1px solid ${T.red}22`,
                borderRadius: '8px', padding: '12px 14px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: T.red, marginBottom: '2px' }}>Account Suspended</div>
                  <div style={{ fontSize: '11px', color: T.text3 }}>Contact support to resolve</div>
                </div>
              </div>
            )}

            {/* Risk bar */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ color: T.text3 }}>Risk Assessment</span>
                <span style={{ fontFamily: T.mono, fontWeight: '600', color: riskColor(riskScore) }}>{riskScore}/100</span>
              </div>
              <div style={{ height: '4px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${riskScore}%`,
                  background: riskColor(riskScore),
                  borderRadius: '2px',
                  transition: 'width .6s cubic-bezier(.22,1,.36,1)',
                }} />
              </div>
            </div>
          </div>

          {/* Top-up / flow panel */}
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: '20px 22px',
            boxShadow: T.shadow,
            animation: 'fadeUp .4s ease .2s both',
          }}>
            {showTopUp ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: T.text2 }}>Add Funds</span>
                  <button
                    onClick={() => { setShowTopUp(false); setTopUpMsg(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, fontSize: '18px', lineHeight: 1, padding: '0 2px' }}
                  >
                    &times;
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    type="number" min="1" placeholder="Amount"
                    style={{
                      flex: 1, padding: '9px 12px',
                      border: `1px solid ${T.border}`, borderRadius: '8px',
                      fontFamily: T.mono, fontSize: '13px',
                      color: T.text, background: T.bg,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleTopUp}
                    disabled={topUpLoading}
                    style={{
                      padding: '9px 16px',
                      background: T.blue, color: '#fff',
                      border: 'none', borderRadius: '8px',
                      fontWeight: '500', fontSize: '13px',
                      cursor: topUpLoading ? 'not-allowed' : 'pointer',
                      opacity: topUpLoading ? .7 : 1,
                      whiteSpace: 'nowrap',
                      transition: 'opacity .15s',
                    }}
                  >
                    {topUpLoading
                      ? <span style={{ display:'inline-block',width:'12px',height:'12px',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite' }} />
                      : 'Add'
                    }
                  </button>
                </div>
                {topUpMsg && (
                  <div style={{
                    fontSize: '12px', padding: '8px 10px', borderRadius: '7px',
                    color:      topUpMsg.includes('success') ? T.green  : T.red,
                    background: topUpMsg.includes('success') ? T.greenDim : T.redDim,
                    border:     `1px solid ${topUpMsg.includes('success') ? T.green : T.red}22`,
                    animation:  'fadeIn .2s ease',
                  }}>
                    {topUpMsg}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Transaction flow diagram */}
                <div style={{ fontSize: '11px', color: T.text4, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                  Transaction Path
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  {[
                    { label: 'You',     color: T.blue,  num: '01' },
                    { label: 'Gateway', color: '#7c3aed',num: '02' },
                    { label: 'Bank',    color: T.green, num: '03' },
                  ].map((node, i, arr) => (
                    <React.Fragment key={node.label}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                          width: '34px', height: '34px',
                          background: `${node.color}0e`,
                          border: `1px solid ${node.color}28`,
                          borderRadius: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700',
                          color: node.color, fontFamily: T.mono,
                        }}>
                          {node.num}
                        </div>
                        <span style={{ fontSize: '9px', color: T.text3, fontFamily: T.mono }}>{node.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ flex: 1, display: 'flex', gap: '3px', paddingBottom: '14px', alignItems: 'center', justifyContent: 'center' }}>
                          {[0, 1, 2].map(d => (
                            <div key={d} style={{
                              width: '5px', height: '1.5px', borderRadius: '1px',
                              background: node.color, opacity: .4,
                              animation: `flowDot 1.4s ease ${d * 0.35}s infinite`,
                            }} />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <p style={{ fontSize: '10px', color: T.text4, textAlign: 'center', marginBottom: '14px' }}>
                  Every transaction is validated through the secure vault layer before reaching your bank.
                </p>
                <button
                  onClick={() => setShowTopUp(true)}
                  style={{
                    width: '100%', padding: '9px',
                    background: T.bg2, border: `1px solid ${T.border}`,
                    borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: '500', color: T.text2,
                    transition: 'all .15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.bg3; e.currentTarget.style.borderColor = T.border2; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = T.border; }}
                >
                  Add Funds
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Chart ── */}
        {chartData.length > 0 && (
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: '20px 22px',
            boxShadow: T.shadow, marginBottom: '20px',
            animation: 'fadeUp .4s ease .25s both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: T.text }}>Transaction Volume</h3>
              <span style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono }}>
                Last {chartData.length} approved
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.blue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={T.blue} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name"
                  tick={{ fill: T.text4, fontSize: 10, fontFamily: T.mono }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: T.text4, fontSize: 10, fontFamily: T.mono }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="amount"
                  stroke={T.blue} strokeWidth={1.5}
                  fill="url(#blueGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Recent activity ── */}
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: T.radius, overflow: 'hidden',
          boxShadow: T.shadow,
          animation: 'fadeUp .4s ease .3s both',
        }}>
          <div style={{
            padding: '16px 22px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: T.text }}>Recent Activity</h3>
            <span style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono }}>
              {txns.slice(0, 8).length} entries
            </span>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {txns.length === 0 ? (
              <div style={{ padding: '52px', textAlign: 'center', color: T.text4, fontSize: '13px' }}>
                No transactions yet
              </div>
            ) : txns.slice(0, 8).map((tx, i) => {
              const m = statusMeta[tx.status] || statusMeta.pending;
              const icon = statusIcon[tx.status] || '.';
              return (
                <div
                  key={tx._id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 22px',
                    borderBottom: `1px solid ${T.border}`,
                    transition: 'background .12s',
                    animation: `fadeUp 0.28s ease ${i * 0.04}s both`,
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bgHov}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Icon */}
                  <div style={{
                    width: '34px', height: '34px',
                    background: m.bg, borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '700', color: m.color, fontFamily: T.mono,
                    border: `1px solid ${m.color}18`,
                  }}>
                    {icon}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: '500', color: T.text,
                      textTransform: 'capitalize', marginBottom: '1px',
                    }}>
                      {tx.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '11px', color: T.text4, fontFamily: T.mono }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Flow */}
                  <FlowBadge status={tx.status} />

                  {/* Amount + badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: '600', fontFamily: T.mono,
                      letterSpacing: '-0.5px', marginBottom: '3px',
                      color: tx.status === 'approved' ? T.text
                           : tx.status === 'blocked' || tx.status === 'rejected' ? T.text3
                           : m.color,
                    }}>
                      {tx.amount > 0
                        ? (tx.status === 'approved' ? `-Rs.${tx.amount.toLocaleString()}` : `Rs.${tx.amount.toLocaleString()}`)
                        : '—'}
                    </div>
                    <Badge status={tx.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
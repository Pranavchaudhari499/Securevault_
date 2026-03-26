import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { useAuth } from '../../context/AuthContext';
import { userAPI, transactionAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const riskColors = {
  low: 'var(--green)',
  medium: 'var(--amber)',
  high: 'var(--red)',
  critical: 'var(--red)',
};

function StatCard({ label, value, sub, color, index }) {
  return (
    <div className="card" style={{
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      animation: `fadeUp 0.3s ease ${index * 0.06}s both`,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: '500' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color, fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// Transaction flow diagram component
function TransactionFlowBadge({ status }) {
  const steps = [
    { label: 'User', icon: '👤', done: true },
    { label: 'Gateway', icon: '🛡️', done: status !== 'processing' },
    { label: 'Bank', icon: '🏛️', done: status === 'approved' || status === 'rejected' || status === 'blocked' },
  ];

  const getStepColor = (step, i) => {
    if (!step.done) return 'var(--text-4)';
    if (status === 'blocked' || status === 'rejected') return i === steps.length - 1 ? 'var(--red)' : 'var(--green)';
    if (status === 'flagged') return i === 1 ? 'var(--amber)' : i === 0 ? 'var(--green)' : 'var(--text-4)';
    return 'var(--green)';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px',
              background: step.done ? `${getStepColor(step, i)}18` : 'var(--bg-2)',
              border: `1px solid ${step.done ? `${getStepColor(step, i)}44` : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px',
            }}>{step.icon}</div>
            <div style={{ fontSize: '8px', color: getStepColor(step, i), fontFamily: 'var(--mono)', fontWeight: '500' }}>{step.label}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', gap: '2px', paddingBottom: '12px' }}>
              {[0,1,2].map(d => (
                <div key={d} className={step.done ? 'flow-dot' : ''} style={{
                  width: '4px', height: '2px',
                  borderRadius: '1px',
                  background: step.done ? getStepColor(step, i) : 'var(--text-4)',
                  opacity: step.done ? 0.8 : 0.3,
                  animationDelay: step.done ? `${d * 0.25}s` : '0s',
                }} />
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const statusStyles = {
  approved: { badge: 'badge-green', icon: '✓', bg: 'var(--green-dim)' },
  blocked: { badge: 'badge-red', icon: '✗', bg: 'var(--red-dim)' },
  flagged: { badge: 'badge-amber', icon: '⚠', bg: 'var(--amber-dim)' },
  processing: { badge: 'badge-blue', icon: '⟳', bg: 'var(--blue-dim)' },
  rejected: { badge: 'badge-red', icon: '✗', bg: 'var(--red-dim)' },
  pending: { badge: 'badge-blue', icon: '…', bg: 'var(--blue-dim)' },
  frozen: { badge: 'badge-blue', icon: '❄', bg: 'var(--blue-dim)' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ color: 'var(--text-3)', marginBottom: '4px', fontFamily: 'var(--mono)', fontSize: '11px' }}>{label}</div>
        <div style={{ color: 'var(--blue)', fontWeight: '600', fontFamily: 'var(--mono)' }}>₹{payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

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
      setTopUpMsg(`₹${topUpAmount} added successfully`);
      setTopUpAmount('');
      load();
    } catch (e) { setTopUpMsg(e.message || 'Failed'); }
    setTopUpLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '960px' }}>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }} />)}
          </div>
          <div className="grid-2" style={{ marginBottom: '24px' }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '180px', borderRadius: '16px' }} />)}
          </div>
          <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }} />
        </div>
      </Layout>
    );
  }

  const riskColor = riskColors[profile?.riskLevel] || 'var(--green)';
  const chartData = txns
    .filter(t => t.amount > 0 && t.status === 'approved')
    .slice(0, 10)
    .reverse()
    .map((t, i) => ({ name: `T${i + 1}`, amount: t.amount }));

  return (
    <Layout>
      <div style={{ maxWidth: '960px' }}>
        {/* Status banners */}
        {(profile?.isSuspended || profile?.status === 'blocked') && (
          <div className="fade-in" style={{
            background: 'var(--red-dim)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex', alignItems: 'flex-start', gap: '14px',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>🔒</div>
            <div>
              <div style={{ fontWeight: '700', color: 'var(--red)', fontSize: '13px', marginBottom: '3px' }}>Account Suspended</div>
              <div style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>{profile?.suspendedReason}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '5px', fontFamily: 'var(--mono)' }}>
                Contact your bank to reactivate.{profile?.suspendedAt ? ` Suspended: ${new Date(profile.suspendedAt).toLocaleString()}` : ''}
              </div>
            </div>
          </div>
        )}

        {profile?.status === 'flagged' && !profile?.isSuspended && (
          <div className="fade-in" style={{
            background: 'var(--amber-dim)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>⚠️</div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--amber)', fontSize: '13px', marginBottom: '2px' }}>Account Flagged</div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px' }}>Your account has been flagged for suspicious activity. Some transactions may be restricted.</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          <StatCard index={0} label="Available Balance" value={`₹${(profile?.balance || 0).toLocaleString()}`} sub={profile?.frozenBalance > 0 ? `₹${profile.frozenBalance} frozen` : 'No holds'} color="var(--blue)" />
          <StatCard index={1} label="Risk Score" value={profile?.riskScore || 0} sub={(profile?.riskLevel || 'low').toUpperCase()} color={riskColor} />
          <StatCard index={2} label="Transactions" value={profile?.behaviorProfile?.totalTransactions || 0} sub="Lifetime total" color="var(--purple)" />
          <StatCard index={3} label="Avg Transaction" value={`₹${Math.round(profile?.behaviorProfile?.avgTransactionAmount || 0).toLocaleString()}`} sub="Spending baseline" color="var(--cyan)" />
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Risk gauge */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Security Risk</h3>
              <span className={`badge badge-${profile?.riskScore >= 60 ? 'red' : profile?.riskScore >= 35 ? 'amber' : 'green'}`}>
                {(profile?.riskLevel || 'low').toUpperCase()}
              </span>
            </div>

            {/* Gauge visual */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <div style={{ height: '8px', background: 'var(--bg-2)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  height: '100%',
                  width: `${profile?.riskScore || 0}%`,
                  borderRadius: '6px',
                  background: `linear-gradient(90deg, var(--green) 0%, var(--amber) 50%, var(--red) 100%)`,
                  backgroundSize: `${(1 / ((profile?.riskScore || 1) / 100)) * 100}% 100%`,
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                <span>SAFE</span>
                <span style={{ color: riskColor, fontWeight: '700' }}>{profile?.riskScore || 0} / 100</span>
                <span>CRITICAL</span>
              </div>
            </div>

            {profile?.mlFlagReasons?.length > 0 && (
              <div style={{ background: 'var(--amber-dim)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--amber)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ML Signals</div>
                {profile.mlFlagReasons.slice(0, 2).map((r, i) => (
                  <div key={i} style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: '3px', display: 'flex', gap: '6px', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--amber)', flexShrink: 0 }}>—</span>{r}
                  </div>
                ))}
              </div>
            )}

            {/* Account details */}
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: '3px' }}>ACCOUNT</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{profile?.accountNumber || '-'}</div>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: '3px' }}>UPI ID</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.upiId || '-'}</div>
              </div>
            </div>
          </div>

          {/* Balance & Top-up */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Wallet</h3>
              <button
                className={`btn ${showTopUp ? 'btn-ghost' : 'btn-primary'}`}
                style={{ fontSize: '12px', padding: '5px 14px' }}
                onClick={() => { setShowTopUp(!showTopUp); setTopUpMsg(''); }}
              >
                {showTopUp ? 'Cancel' : '+ Add Funds'}
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '34px', fontWeight: '800', color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                ₹{(profile?.balance || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>Available balance</div>
            </div>

            {showTopUp ? (
              <div className="fade-in">
                {/* Quick amounts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {[1000, 5000, 10000, 25000].map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setTopUpAmount(String(a))}
                      style={{
                        background: topUpAmount === String(a) ? 'var(--blue-dim)' : 'var(--bg-2)',
                        border: `1px solid ${topUpAmount === String(a) ? 'rgba(79,110,247,0.3)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        padding: '7px 4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontFamily: 'var(--mono)',
                        color: topUpAmount === String(a) ? 'var(--blue)' : 'var(--text-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      +{(a / 1000).toFixed(0)}K
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    type="number"
                    placeholder="Custom amount"
                    min="1" max="100000"
                    style={{ fontSize: '13px' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleTopUp}
                    disabled={topUpLoading}
                    style={{ whiteSpace: 'nowrap', padding: '9px 16px', fontSize: '13px' }}
                  >
                    {topUpLoading ? <span className="spin" style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> : 'Add'}
                  </button>
                </div>
                {topUpMsg && (
                  <div className="fade-in" style={{
                    fontSize: '12px',
                    color: topUpMsg.includes('success') ? 'var(--green)' : 'var(--red)',
                    background: topUpMsg.includes('success') ? 'var(--green-dim)' : 'var(--red-dim)',
                    padding: '8px 10px', borderRadius: '8px',
                    border: `1px solid ${topUpMsg.includes('success') ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                  }}>
                    {topUpMsg}
                  </div>
                )}
              </div>
            ) : (
              /* Transaction flow preview */
              <div style={{ background: 'var(--bg-2)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Transaction Path</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {[
                    { label: 'You', icon: '👤', color: 'var(--blue)' },
                    { label: 'Gateway', icon: '🛡️', color: 'var(--purple)' },
                    { label: 'Bank', icon: '🏛️', color: 'var(--green)' },
                  ].map((node, i, arr) => (
                    <React.Fragment key={node.label}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: i === 0 || i === arr.length - 1 ? '0 0 auto' : '0 0 auto' }}>
                        <div style={{
                          width: '32px', height: '32px',
                          background: `${node.color}14`,
                          border: `1px solid ${node.color}33`,
                          borderRadius: '9px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px',
                        }}>{node.icon}</div>
                        <div style={{ fontSize: '9px', color: node.color, fontFamily: 'var(--mono)', fontWeight: '500' }}>{node.label}</div>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ flex: 1, display: 'flex', gap: '3px', paddingBottom: '14px', alignItems: 'center', justifyContent: 'center' }}>
                          {[0, 1, 2].map(d => (
                            <div key={d} className="flow-dot" style={{
                              width: '4px', height: '2px',
                              borderRadius: '1px',
                              background: node.color,
                              animationDelay: `${d * 0.25}s`,
                            }} />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '8px', textAlign: 'center' }}>
                  All transactions are routed through the secure vault
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)' }}>Transaction History</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Last {chartData.length} approved</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#4f6ef7" strokeWidth={2} fill="url(#balanceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent transactions */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>Recent Activity</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{txns.slice(0, 8).length} transactions</span>
          </div>
          <div style={{ maxHeight: '360px', overflow: 'auto' }}>
            {txns.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💳</div>
                No transactions yet
              </div>
            ) : txns.slice(0, 8).map((tx, i) => {
              const s = statusStyles[tx.status] || statusStyles.pending;
              return (
                <div key={tx._id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.12s',
                  animation: `fadeUp 0.25s ease ${i * 0.04}s both`,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '36px', height: '36px',
                    background: s.bg,
                    borderRadius: '10px',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: '700',
                    color: tx.status === 'approved' ? 'var(--green)' : tx.status === 'blocked' || tx.status === 'rejected' ? 'var(--red)' : 'var(--amber)',
                    fontFamily: 'var(--mono)',
                  }}>
                    {s.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', textTransform: 'capitalize', marginBottom: '1px' }}>
                      {tx.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Flow indicator */}
                  <TransactionFlowBadge status={tx.status} />

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: '700', fontFamily: 'var(--mono)', letterSpacing: '-0.5px',
                      color: tx.status === 'blocked' || tx.status === 'rejected' ? 'var(--text-3)' : tx.status === 'flagged' ? 'var(--amber)' : 'var(--text)',
                    }}>
                      {tx.amount > 0 ? (tx.status === 'approved' ? `-₹${tx.amount.toLocaleString()}` : `₹${tx.amount.toLocaleString()}`) : '-'}
                    </div>
                    <span className={`badge ${s.badge}`} style={{ fontSize: '10px' }}>{tx.status}</span>
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
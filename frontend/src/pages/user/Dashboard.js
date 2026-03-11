import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { useAuth } from '../../context/AuthContext';
import { userAPI, transactionAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const riskColors = { low: 'var(--green)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)' };

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
          // ✅ Sync AuthContext with latest riskScore from server
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
      // ✅ Listen for correct event names
      socket.on('transaction-result', load);
      socket.on('account-suspended', load);
      socket.on('account-blocked', load);   // fired when bank/gateway blocks
      socket.on('notification', load);      // fired when bank approves/unblocks

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

  if (loading) return <Layout><div style={{ color: 'var(--text-3)', padding: '40px' }}>Loading...</div></Layout>;

  const riskColor = riskColors[profile?.riskLevel] || 'var(--green)';

  // Build spending chart from last 10 approved txns only
  const chartData = txns
    .filter(t => t.amount > 0 && t.status === 'approved')
    .slice(0, 10)
    .reverse()
    .map((t, i) => ({ name: `T${i + 1}`, amount: t.amount }));

  return (
    <Layout>
      <div style={{ maxWidth: '960px' }}>
        {/* Suspension Banner */}
        {(profile?.isSuspended || profile?.status === 'blocked') && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: '24px' }} className="fade-in">
            <div style={{ fontWeight: '600', color: 'var(--red)', marginBottom: '3px', fontSize: '13px' }}>Account Suspended</div>
            <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{profile?.suspendedReason}</div>
            <div style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '4px', fontFamily: 'var(--mono)' }}>
              Contact your bank to reactivate.{profile?.suspendedAt ? ` Suspended: ${new Date(profile.suspendedAt).toLocaleString()}` : ''}
            </div>
          </div>
        )}

        {/* Flagged warning (not fully blocked, but flagged) */}
        {profile?.status === 'flagged' && !profile?.isSuspended && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: '24px' }} className="fade-in">
            <div style={{ fontWeight: '600', color: 'var(--amber)', marginBottom: '3px', fontSize: '13px' }}>Account Flagged</div>
            <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>Your account has been flagged for suspicious activity. Some transactions may be restricted.</div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Available Balance', value: `Rs.${(profile?.balance || 0).toLocaleString()}`, sub: profile?.frozenBalance > 0 ? `Rs.${profile?.frozenBalance} frozen` : null, color: 'var(--blue)' },
            { label: 'Risk Score', value: `${profile?.riskScore || 0}`, sub: (profile?.riskLevel || 'low').toUpperCase(), color: riskColor },
            { label: 'Total Transactions', value: profile?.behaviorProfile?.totalTransactions || 0, sub: 'Lifetime', color: 'var(--purple)' },
            { label: 'Avg Transaction', value: `Rs.${Math.round(profile?.behaviorProfile?.avgTransactionAmount || 0).toLocaleString()}`, sub: 'Baseline', color: 'var(--cyan)' }
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card" style={{ padding: '18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color, fontFamily: 'var(--mono)', marginBottom: sub ? '3px' : 0 }}>{value}</div>
              {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Risk Gauge */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Security Risk</h3>
              <span className={`badge badge-${profile?.riskScore >= 60 ? 'red' : profile?.riskScore >= 35 ? 'amber' : 'green'}`}>
                {(profile?.riskLevel || 'low').toUpperCase()}
              </span>
            </div>
            <div className="risk-bar" style={{ marginBottom: '8px' }}>
              <div className="risk-fill" style={{ width: `${profile?.riskScore || 0}%`, background: `linear-gradient(90deg, var(--green), ${riskColor})` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: '16px' }}>
              <span>0 SAFE</span><span>{profile?.riskScore || 0}/100</span><span>100 CRITICAL</span>
            </div>
            {profile?.mlFlagReasons?.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--amber)', background: 'var(--amber-dim)', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>ML Flag Reasons</div>
                {profile.mlFlagReasons.slice(0, 2).map((r, i) => (
                  <div key={i} style={{ color: 'var(--text-2)', marginTop: '2px' }}>- {r}</div>
                ))}
              </div>
            )}
          </div>

          {/* Balance top-up */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Add Funds</h3>
              <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => setShowTopUp(!showTopUp)}>
                {showTopUp ? 'Cancel' : '+ Top Up'}
              </button>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>
              Rs.{(profile?.balance || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>
              Account: <span className="mono">{profile?.accountNumber}</span> &nbsp;|&nbsp; UPI: <span className="mono">{profile?.upiId}</span>
            </div>
            {showTopUp && (
              <div className="fade-in">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    type="number"
                    placeholder="Amount (max Rs.1,00,000)"
                    min="1"
                    max="100000"
                  />
                  <button className="btn btn-primary" onClick={handleTopUp} disabled={topUpLoading} style={{ whiteSpace: 'nowrap', padding: '9px 16px' }}>
                    {topUpLoading ? '...' : 'Add'}
                  </button>
                </div>
                {topUpMsg && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: topUpMsg.includes('success') ? 'var(--green)' : 'var(--red)' }}>
                    {topUpMsg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[1000, 5000, 10000, 25000].map(a => (
                    <button key={a} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setTopUpAmount(String(a))}>
                      +{a.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Spending chart — approved transactions only */}
        {chartData.length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Recent Transaction Amounts</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="amount" stroke="#4f6ef7" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent transactions */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3>Recent Activity</h3>
          </div>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {txns.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>No transactions yet</div>
            ) : txns.slice(0, 8).map(tx => (
              <div key={tx._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: '32px', height: '32px',
                  background: tx.status === 'approved' ? 'var(--green-dim)' : tx.status === 'blocked' ? 'var(--red-dim)' : 'var(--amber-dim)',
                  borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  {tx.status === 'approved' ? '✓' : tx.status === 'blocked' ? '✗' : '⚠'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                    {tx.type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'var(--mono)', color: tx.status === 'blocked' ? 'var(--text-3)' : tx.status === 'flagged' ? 'var(--amber)' : 'var(--text)' }}>
                    {/* ✅ Flagged transactions show amount but marked as not deducted */}
                    {tx.amount > 0 ? (tx.status === 'approved' ? `-Rs.${tx.amount.toLocaleString()}` : `Rs.${tx.amount.toLocaleString()}`) : '-'}
                  </div>
                  <span className={`badge badge-${tx.status === 'approved' ? 'green' : tx.status === 'blocked' ? 'red' : 'amber'}`} style={{ fontSize: '10px' }}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
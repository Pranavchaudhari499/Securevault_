import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

export default function BankDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [error, setError] = useState(null);
  
  const isMounted = useRef(true);
  const prevStatsRef = useRef({});
  const dataRef = useRef(null);

  const load = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setError(null);
      const d = await bankAPI.getDashboard();
      if (isMounted.current && d) {
        if (dataRef.current?.stats) {
          prevStatsRef.current = dataRef.current.stats;
        }
        dataRef.current = d;
        setData(d);
        setLastUpdated(new Date());
      }
    } catch (e) { 
      console.error('Bank dashboard error:', e);
      if (isMounted.current) setError('Failed to load dashboard data');
    } finally { 
      if (isMounted.current && showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    load();
    
    const socket = getSocket();
    if (!socket) return;

    const bumpStat = (key, amount = 1) => {
      if (!isMounted.current) return;
      setData(prev => {
        if (!prev) return prev;
        prevStatsRef.current = prev.stats || prevStatsRef.current;
        const updated = {
          ...prev,
          stats: {
            ...prev.stats,
            [key]: (prev.stats?.[key] || 0) + amount
          }
        };
        dataRef.current = updated;
        return updated;
      });
      setLastUpdated(new Date());
    };

    // user-flagged: bump flaggedUsers, then re-fetch for fresh topAlerts
    const handleUserFlagged = (userData) => {
      console.log('🚨 User flagged:', userData);
      bumpStat('flaggedUsers');
      load(false);
    };

    // user-blocked: bump blockedUsers, then re-fetch
    const handleUserBlocked = (userData) => {
      console.log('🚫 User blocked:', userData);
      bumpStat('blockedUsers');
      load(false);
    };

    // user-approved / user-unblocked: decrement the right counters, re-fetch
    const handleUserApproved = (userData) => {
      console.log('✅ User approved:', userData);
      load(false);
    };

    const handleUserUnblocked = (userData) => {
      console.log('🔓 User unblocked:', userData);
      load(false);
    };

    // fraud-alert-update: bump pendingAlerts, re-fetch for fresh topAlerts list
    const handleNewAlert = (alertData) => {
      console.log('🔔 New fraud alert:', alertData);
      bumpStat('pendingAlerts');
      load(false);
    };

    const handleStatsUpdate = (statsData) => {
      if (!statsData || !isMounted.current) return;
      setData(prev => {
        if (!prev) return prev;
        prevStatsRef.current = prev.stats || prevStatsRef.current;
        const updated = { ...prev, stats: { ...prev.stats, ...statsData } };
        dataRef.current = updated;
        return updated;
      });
      setLastUpdated(new Date());
    };

    const handleNewTransaction = () => {
      if (!isMounted.current) return;
      bumpStat('totalTx');
    };

    socket.on('user-flagged',     handleUserFlagged);
    socket.on('user-blocked',     handleUserBlocked);
    socket.on('user-approved',    handleUserApproved);
    socket.on('user-unblocked',   handleUserUnblocked);
    socket.on('fraud-alert-update', handleNewAlert);
    socket.on('stats-update',     handleStatsUpdate);
    socket.on('new-transaction',  handleNewTransaction);

    return () => {
      isMounted.current = false;
      socket.off('user-flagged',     handleUserFlagged);
      socket.off('user-blocked',     handleUserBlocked);
      socket.off('user-approved',    handleUserApproved);
      socket.off('user-unblocked',   handleUserUnblocked);
      socket.off('fraud-alert-update', handleNewAlert);
      socket.off('stats-update',     handleStatsUpdate);
      socket.off('new-transaction',  handleNewTransaction);
    };
  }, []); // runs once — never tears down/re-registers on re-render

  // Auto-refresh fallback every 15s
  useEffect(() => {
    const interval = setInterval(() => load(false), 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          padding: '60px 40px', 
          color: 'var(--text-3)', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '14px' }}>Loading dashboard...</div>
          <div style={{ width: '30px', height: '30px', border: '2px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ 
          padding: '60px 40px', 
          color: 'var(--red)', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '24px' }}>⚠️</div>
          <div style={{ fontSize: '14px' }}>{error}</div>
          <button 
            onClick={load}
            style={{
              background: 'var(--blue)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '12px',
              color: 'white',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  const stats = {
    totalTx: 0,
    flaggedUsers: 0,
    blockedUsers: 0,
    pendingAlerts: 0,
    ...(data?.stats || {})
  };

  const riskMap = (data?.riskDistribution || []).reduce((a, r) => { 
    a[r._id] = r.count; 
    return a; 
  }, {});
  
  const total = Object.values(riskMap).reduce((a, b) => a + b, 0) || 1;
  const getPercentage = (count) => Math.round((count / total) * 100) || 0;

  const hasFlaggedChanged = prevStatsRef.current.flaggedUsers !== undefined && 
                           stats.flaggedUsers > prevStatsRef.current.flaggedUsers;
  const hasBlockedChanged = prevStatsRef.current.blockedUsers !== undefined && 
                           stats.blockedUsers > prevStatsRef.current.blockedUsers;
  const hasAlertsChanged  = prevStatsRef.current.pendingAlerts !== undefined && 
                           stats.pendingAlerts > prevStatsRef.current.pendingAlerts;

  return (
    <Layout>
      <div style={{ maxWidth: '1100px' }}>
        {/* Live status bar */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '8px 12px',
          background: 'rgba(79,110,247,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(79,110,247,0.2)',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              <span style={{ color: 'var(--text-2)' }}>Live</span>
            </span>
            <span style={{ color: 'var(--text-3)' }}>•</span>
            <span style={{ color: 'var(--text-2)' }}>
              Last update: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasFlaggedChanged && (
              <span style={{ color: 'var(--amber)', fontSize: '11px' }}>⚠️ New flagged</span>
            )}
            {hasBlockedChanged && (
              <span style={{ color: 'var(--red)', fontSize: '11px' }}>🚫 New blocked</span>
            )}
            {hasAlertsChanged && (
              <span style={{ color: 'var(--purple)', fontSize: '11px' }}>🔔 New alert</span>
            )}
            <button
              onClick={() => load(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--text-2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Transactions', value: stats.totalTx,      color: 'var(--green)',  icon: '📊', changed: false },
            { label: 'Flagged Users',       value: stats.flaggedUsers, color: 'var(--amber)',  icon: '⚠️', changed: hasFlaggedChanged },
            { label: 'Blocked Users',       value: stats.blockedUsers, color: 'var(--red)',    icon: '🚫', changed: hasBlockedChanged },
            { label: 'Pending Alerts',      value: stats.pendingAlerts,color: 'var(--purple)', icon: '🔔', changed: hasAlertsChanged },
          ].map(({ label, value, color, icon, changed }) => (
            <div 
              key={label} 
              className="card" 
              style={{ 
                padding: '18px', 
                position: 'relative', 
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                border: `1px solid ${value > 0 ? color + '30' : 'var(--border)'}`,
                animation: changed ? 'highlight 1s ease' : 'none'
              }}
            >
              <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px', 
                background: `linear-gradient(90deg, ${color}, transparent)` 
              }} />
              <div style={{ 
                fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', 
                textTransform: 'uppercase', letterSpacing: '0.06em',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                {label}
                <span style={{ fontSize: '16px' }}>{icon}</span>
              </div>
              <div style={{ 
                fontSize: '32px', fontWeight: '700', 
                color: value > 0 ? color : 'var(--text-3)', 
                fontFamily: 'var(--mono)', lineHeight: '1.2', transition: 'color 0.3s ease'
              }}>
                {value.toLocaleString()}
              </div>
              {changed && (
                <div style={{
                  position: 'absolute', bottom: '12px', right: '12px',
                  fontSize: '10px', color,
                  background: `${color}20`, padding: '2px 6px',
                  borderRadius: '12px', animation: 'fadeIn 0.5s'
                }}>
                  +1 new
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Transaction Volume (7 Days)</h3>
            {(data?.dailyStats || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.dailyStats}>
                  <XAxis dataKey="_id" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)' }} />
                  <Bar dataKey="approved" name="Approved" fill="var(--green)" radius={[3,3,0,0]} />
                  <Bar dataKey="flagged"  name="Flagged"  fill="var(--amber)" radius={[3,3,0,0]} />
                  <Bar dataKey="blocked"  name="Blocked"  fill="var(--red)"   radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                <span>📊 No transaction data yet</span>
                <span style={{ fontSize: '11px' }}>Data will appear as transactions occur</span>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>User Risk Distribution</h3>
            {[
              { k: 'low',      label: 'Low Risk', color: 'var(--green)' },
              { k: 'medium',   label: 'Medium',   color: 'var(--blue)'  }, 
              { k: 'high',     label: 'High Risk', color: 'var(--amber)' }, 
              { k: 'critical', label: 'Critical',  color: 'var(--red)'   }
            ].map(({ k, label, color }) => {
              const count = riskMap[k] || 0;
              const pct = getPercentage(count);
              return (
                <div key={k} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-2)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--mono)', color, fontWeight: '600' }}>{count} ({pct}%)</span>
                  </div>
                  <div className="risk-bar">
                    <div className="risk-fill" style={{ width: `${pct}%`, background: color, transition: 'width 0.5s ease-in-out' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Alerts */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Top Priority Fraud Alerts</h3>
            <Link 
              to="/bank/fraud-alerts"
              style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79,110,247,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              View All <span style={{ fontSize: '14px' }}>→</span>
            </Link>
          </div>
          
          {(data?.topAlerts || []).length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
              ✅ No active fraud alerts
            </div>
          ) : (
            data.topAlerts.map((a, index) => (
              <Link key={a._id} to={`/bank/fraud-alerts/${a._id}`} style={{ textDecoration: 'none' }}>
                <div 
                  style={{ 
                    padding: '16px 20px', 
                    borderBottom: index === data.topAlerts.length - 1 ? 'none' : '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    transition: 'background 0.2s', cursor: 'pointer',
                    background: a.isNew ? 'rgba(244,63,94,0.05)' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: a.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)',
                    animation: a.fraudScore >= 80 ? 'pulse 2s infinite' : 'none'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {a.userId?.name || 'Unknown User'}
                      {a.userId?.email && (
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontWeight: 'normal' }}>
                          {a.userId.email}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
                      {a.fraudReason || 'Suspicious activity detected'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'var(--mono)', color: a.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)' }}>
                      {a.fraudScore}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {a.suspiciousActivityCount || 0} incidents
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%   { opacity: 1; transform: scale(1); }
            50%  { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes highlight {
            0%   { background-color: rgba(244,63,94,0.2); }
            100% { background-color: transparent; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </Layout>
  );
}
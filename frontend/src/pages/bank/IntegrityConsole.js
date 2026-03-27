import React, { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const SEPOLIA_TX = 'https://sepolia.etherscan.io/tx/';

function badgeStyle(kind) {
  if (kind === 'confirmed') {
    return {
      color: '#166534',
      background: 'rgba(34,197,94,0.12)',
      border: '1px solid rgba(34,197,94,0.28)',
    };
  }
  return {
    color: '#b45309',
    background: 'rgba(245,158,11,0.14)',
    border: '1px solid rgba(245,158,11,0.28)',
  };
}

function levelColor(level) {
  if (level === 'critical') return '#9f1239';
  if (level === 'high') return '#b91c1c';
  if (level === 'medium') return '#b45309';
  return '#2563eb';
}

export default function IntegrityConsole() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState(null);
  const [verifyLoadingId, setVerifyLoadingId] = useState(null);
  const [verifiedRows, setVerifiedRows] = useState({});
  const [recentlyConfirmed, setRecentlyConfirmed] = useState({});

  const previousByIdRef = useRef({});

  const load = useCallback(async () => {
    try {
      const [alertsRes, statusRes] = await Promise.all([
        bankAPI.getFraudAlerts({ status: 'all' }),
        bankAPI.getBlockchainStatus(),
      ]);

      const nextAlerts = (alertsRes?.alerts || [])
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);

      const previous = previousByIdRef.current;
      const transitions = {};

      for (const a of nextAlerts) {
        const old = previous[a._id];
        const wasPending = old && !old.chainEventId;
        const nowConfirmed = Boolean(a.chainEventId);
        if (wasPending && nowConfirmed) {
          transitions[a._id] = Date.now();
        }
      }

      if (Object.keys(transitions).length) {
        setRecentlyConfirmed((prev) => ({ ...prev, ...transitions }));
      }

      const map = {};
      for (const a of nextAlerts) map[a._id] = a;
      previousByIdRef.current = map;

      setAlerts(nextAlerts);
      setChainStatus(statusRes?.blockchain || null);
    } catch (e) {
      console.error('IntegrityConsole:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000);
    const socket = getSocket();
    if (socket) socket.on('fraud-alert-update', load);

    return () => {
      clearInterval(interval);
      const s2 = getSocket();
      if (s2) s2.off('fraud-alert-update', load);
    };
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRecentlyConfirmed((prev) => {
        const now = Date.now();
        const next = {};
        Object.keys(prev).forEach((k) => {
          if (now - prev[k] < 12000) next[k] = prev[k];
        });
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  async function verifyRecord(alert) {
    if (!alert?.chainEventId) return;
    setVerifyLoadingId(alert._id);
    try {
      const res = await bankAPI.verifyOnChain(alert.chainEventId);
      setVerifiedRows((prev) => ({ ...prev, [alert._id]: res?.record || null }));
    } catch (e) {
      setVerifiedRows((prev) => ({ ...prev, [alert._id]: { error: e?.message || 'Verification failed' } }));
    } finally {
      setVerifyLoadingId(null);
    }
  }

  const confirmed = alerts.filter((a) => a.chainEventId).length;
  const pending = alerts.length - confirmed;

  return (
    <Layout>
      <div style={{ maxWidth: '1120px' }}>
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ marginBottom: '5px' }}>Integrity Console</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
            Live blockchain proof stream for fraud events: pending to confirmed with one-click verification.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px', fontFamily: 'var(--mono)' }}>Live Events</div>
            <div style={{ fontSize: '26px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{alerts.length}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px', fontFamily: 'var(--mono)' }}>Pending Chain Proof</div>
            <div style={{ fontSize: '26px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#b45309' }}>{pending}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px', fontFamily: 'var(--mono)' }}>Confirmed On-Chain</div>
            <div style={{ fontSize: '26px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#166534' }}>{confirmed}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px', fontFamily: 'var(--mono)' }}>Network</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>
              {chainStatus?.enabled ? `${chainStatus.network || 'Sepolia'} · active` : 'Offline'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
              events: {chainStatus?.totalEvents ?? '-'}
            </div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>Live Proof Stream</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>auto-refresh: 6s</div>
          </div>

          {loading ? (
            <div style={{ padding: '26px 16px', color: 'var(--text-3)' }}>Loading chain events...</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: '26px 16px', color: 'var(--text-3)' }}>No fraud events available yet.</div>
          ) : (
            <div style={{ maxHeight: '72vh', overflow: 'auto' }}>
              {alerts.map((a) => {
                const isConfirmed = Boolean(a.chainEventId);
                const rowBadge = badgeStyle(isConfirmed ? 'confirmed' : 'pending');
                const fresh = Boolean(recentlyConfirmed[a._id]);
                const verification = verifiedRows[a._id];
                return (
                  <div key={a._id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '7px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{a.userId?.name || 'Unknown User'}</span>
                      <span style={{ fontSize: '10px', color: levelColor(a.alertLevel), border: `1px solid ${levelColor(a.alertLevel)}55`, background: `${levelColor(a.alertLevel)}12`, borderRadius: '12px', padding: '2px 8px', textTransform: 'uppercase', fontWeight: 700 }}>
                        {a.alertLevel || 'unknown'}
                      </span>
                      <span style={{ fontSize: '10px', borderRadius: '12px', padding: '2px 8px', fontWeight: 700, ...rowBadge }}>
                        {isConfirmed ? 'CONFIRMED' : 'PENDING'}
                      </span>
                      {fresh && (
                        <span style={{ fontSize: '10px', color: '#6d28d9', background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.25)', borderRadius: '12px', padding: '2px 8px', fontWeight: 700 }}>
                          JUST CONFIRMED
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.6fr 2.2fr', gap: '10px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--mono)' }}>Reason</div>
                        <div style={{ color: 'var(--text)' }}>{(a.fraudReasons && a.fraudReasons[0]) || 'Suspicious activity'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--mono)' }}>Risk</div>
                        <div style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{a.fraudScore ?? '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--mono)' }}>Chain Event</div>
                        <div style={{ fontFamily: 'var(--mono)' }}>{a.chainEventId ? `#${a.chainEventId}` : 'waiting...'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--mono)' }}>Created</div>
                        <div style={{ fontFamily: 'var(--mono)' }}>{new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => verifyRecord(a)}
                        disabled={!a.chainEventId || verifyLoadingId === a._id}
                        className="btn btn-ghost"
                        style={{ fontSize: '11px', padding: '6px 10px' }}
                      >
                        {verifyLoadingId === a._id ? 'Verifying...' : 'Verify Record'}
                      </button>

                      {a.chainTxHash ? (
                        <a
                          href={`${SEPOLIA_TX}${a.chainTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost"
                          style={{ fontSize: '11px', padding: '6px 10px', textDecoration: 'none' }}
                        >
                          Open Explorer
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Explorer link available after confirmation.</span>
                      )}

                      {verification?.eventId && (
                        <span style={{ fontSize: '11px', color: '#166534', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.26)', borderRadius: '8px', padding: '4px 8px' }}>
                          Verified on-chain: event #{verification.eventId}
                        </span>
                      )}

                      {verification?.error && (
                        <span style={{ fontSize: '11px', color: '#b91c1c', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '4px 8px' }}>
                          {verification.error}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

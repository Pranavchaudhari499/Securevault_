/**
 * FraudAlerts.js  — Bank portal  (blockchain integration baked in)
 * frontend/src/pages/bank/FraudAlerts.js
 *
 * What changed from original:
 *  - BlockchainVerify rendered inside every expanded alert detail panel
 *  - Chain-proof mini-badge on the alert header (shows ⛓ when chainEventId exists)
 *  - Blockchain status pill in the page header (fetched once on mount)
 *  - Modal confirmation note references blockchain audit trail
 */

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

/* ── Animation injection ─────────────────────────────────────────────────── */
function injectAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vault-fraud-anim')) return;
  const s = document.createElement('style');
  s.id = 'vault-fraud-anim';
  s.textContent = `
    @keyframes fraudShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    @keyframes fraudFadeUp {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes fraudExpand {
      from { opacity:0; transform:translateY(-6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes fraudPulse {
      0%,100% { opacity:1; }
      50%     { opacity:0.4; }
    }
    @keyframes fraudModalIn {
      from { opacity:0; transform:scale(0.97) translateY(8px); }
      to   { opacity:1; transform:scale(1)    translateY(0); }
    }
    @keyframes chainPing {
      0%   { box-shadow: 0 0 0 0 rgba(139,92,246,0.5); }
      70%  { box-shadow: 0 0 0 6px rgba(139,92,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
    }
  `;
  document.head.appendChild(s);
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const LEVEL_CONFIG = {
  low:      { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.25)',  label: 'Low' },
  medium:   { color: '#D97706', bg: 'rgba(217,119,6,0.08)',    border: 'rgba(217,119,6,0.25)',   label: 'Medium' },
  high:     { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',    border: 'rgba(220,38,38,0.25)',   label: 'High' },
  critical: { color: '#9F1239', bg: 'rgba(159,18,57,0.08)',    border: 'rgba(159,18,57,0.3)',    label: 'Critical' },
};

const STATUS_CONFIG = {
  pending:      { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  reviewed:     { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  auto_blocked: { color: '#9F1239', bg: 'rgba(159,18,57,0.08)' },
  approved:     { color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  monitoring:   { color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
};

const velColor = (v, warn) => v >= warn ? '#DC2626' : '#64748B';

const SEPOLIA_TX = 'https://sepolia.etherscan.io/tx/';

/* ── Small components ────────────────────────────────────────────────────── */
function Pill({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: '20px',
      background: bg, color, fontSize: '11px', fontWeight: '600',
      textTransform: 'capitalize', letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>{label?.replace(/_/g, ' ')}</span>
  );
}

function ScoreRing({ score }) {
  const color = score >= 60 ? '#DC2626' : score >= 30 ? '#D97706' : '#059669';
  const r = 22, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums',
      }}>{score}</div>
    </div>
  );
}

function TimelineItem({ event, timestamp, details, fraudScore, isLast }) {
  const color = (fraudScore || 0) >= 60 ? '#DC2626' : '#D97706';
  return (
    <div style={{ display: 'flex', gap: '12px', paddingBottom: isLast ? 0 : '14px', position: 'relative' }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, marginTop: '3px', boxShadow: `0 0 0 3px ${color}20` }} />
        {!isLast && <div style={{ width: '1px', flex: 1, background: 'rgba(15,23,42,0.1)', marginTop: '4px' }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1F2E', marginBottom: '2px' }}>{event}</div>
        {details && <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>{details}</div>}
        <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '3px' }}>
          {new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {fraudScore != null && (
            <span style={{ marginLeft: '8px', color, fontWeight: '700' }}>Score {fraudScore}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InlineStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', alignItems: 'center' }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ fontWeight: '700', color: color || '#1A1F2E', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function FilterTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 13px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
      fontWeight: active ? '600' : '400',
      background: active ? '#fff' : 'transparent',
      border: active ? '1px solid rgba(15,23,42,0.1)' : '1px solid transparent',
      color: active ? '#1A1F2E' : '#64748B',
      boxShadow: active ? '0 1px 3px rgba(15,23,42,0.06)' : 'none',
      transition: 'all 0.15s ease', textTransform: 'capitalize', fontFamily: 'inherit',
    }}>{label.replace('_', ' ')}</button>
  );
}

function Shimmer({ h, radius = '12px' }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'fraudShimmer 1.6s ease-in-out infinite',
    }} />
  );
}

/* ── 🔗 Inline BlockchainVerify panel ────────────────────────────────────── */
function BlockchainPanel({ alert }) {
  const [verifying, setVerifying] = useState(false);
  const [record,    setRecord]    = useState(null);
  const [error,     setError]     = useState(null);
  const [history,   setHistory]   = useState(null);

  const { chainEventId, chainTxHash } = alert;

  async function verify() {
    if (!chainEventId) return;
    setVerifying(true); setError(null); setRecord(null);
    try {
      const res = await bankAPI.verifyOnChain(chainEventId);
      setRecord(res.record);
    } catch (e) { setError(e?.message || 'Verification failed'); }
    setVerifying(false);
  }

  async function loadHistory() {
    if (!alert.userId?._id) return;
    try {
      const res = await bankAPI.getUserChainHistory(alert.userId._id);
      setHistory(res.chainEventIds || []);
    } catch {}
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(59,130,246,0.04))',
      border: '1px solid rgba(139,92,246,0.18)',
      borderRadius: '12px',
      padding: '16px 18px',
      marginTop: '18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          animation: chainEventId ? 'chainPing 2s ease infinite' : 'none',
        }}>⛓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A1F2E' }}>Blockchain Audit Trail</div>
          <div style={{ fontSize: '10px', color: '#94A3B8' }}>Ethereum Sepolia · immutable record</div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
          background: chainEventId ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
          color: chainEventId ? '#059669' : '#D97706',
          border: `1px solid ${chainEventId ? 'rgba(5,150,105,0.2)' : 'rgba(217,119,6,0.2)'}`,
        }}>
          {chainEventId ? '✓ On-chain' : '⏳ Pending'}
        </span>
      </div>

      {!chainEventId ? (
        <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '8px 0' }}>
          Blockchain confirmation in progress — typically takes 15–30 seconds after flagging.
        </div>
      ) : (
        <>
          {/* Chain details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#64748B' }}>Chain event ID</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#8B5CF6' }}>#{chainEventId}</span>
            </div>
            {chainTxHash && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>Sepolia tx hash</span>
                <a
                  href={`${SEPOLIA_TX}${chainTxHash}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: 'monospace', color: '#3B82F6', textDecoration: 'none', fontSize: '11px' }}
                >
                  {chainTxHash.slice(0, 10)}…{chainTxHash.slice(-8)} ↗
                </a>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={verify}
              disabled={verifying}
              style={{
                flex: 1, fontSize: '11px', fontWeight: '600', padding: '8px 14px',
                borderRadius: '8px', cursor: verifying ? 'wait' : 'pointer',
                background: verifying ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.25)', color: '#7C3AED',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {verifying ? '⏳ Verifying…' : '🔍 Verify on-chain'}
            </button>
            <button
              onClick={loadHistory}
              style={{
                fontSize: '11px', fontWeight: '600', padding: '8px 14px',
                borderRadius: '8px', cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(15,23,42,0.12)',
                color: '#64748B', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              📋 All events
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '8px', color: '#DC2626', fontSize: '11px' }}>
              {error}
            </div>
          )}

          {/* Verified record */}
          {record && (
            <div style={{ marginTop: '12px', background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ color: '#059669', fontWeight: '700', fontSize: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Verified on Sepolia
              </div>
              {[
                ['Action',     record.action],
                ['Risk score', record.riskScore],
                ['Timestamp',  new Date(record.timestamp).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid rgba(5,150,105,0.1)' }}>
                  <span style={{ color: '#64748B' }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#1A1F2E' }}>{v}</span>
                </div>
              ))}
              <div style={{ fontSize: '11px', padding: '4px 0' }}>
                <span style={{ color: '#64748B' }}>DB hash</span>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8', wordBreak: 'break-all', marginTop: '2px' }}>{record.txHash}</div>
              </div>
            </div>
          )}

          {/* Event history list */}
          {history && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                All chain events for this user
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {history.length === 0
                  ? <span style={{ fontSize: '11px', color: '#94A3B8' }}>No on-chain events yet</span>
                  : history.map(id => (
                    <span key={id} style={{
                      fontFamily: 'monospace', fontSize: '11px', fontWeight: '600',
                      padding: '2px 8px', borderRadius: '6px',
                      background: 'rgba(139,92,246,0.08)', color: '#7C3AED',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}>#{id}</span>
                  ))
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   ACTION BUTTON
   ══════════════════════════════════════════ */
function ActionBtn({ label, onClick, color, danger, ghost }) {
  const [hovered, setHovered] = useState(false);
  const base = {
    fontSize: '12px', fontWeight: '600', padding: '8px 16px',
    borderRadius: '9px', cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit',
  };
  if (danger) return (
    <button onClick={onClick} style={{ ...base, border: `1px solid ${color}30`, background: hovered ? color : `${color}10`, color: hovered ? '#fff' : color }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>{label}</button>
  );
  if (ghost) return (
    <button onClick={onClick} style={{ ...base, border: `1px solid ${color}30`, background: hovered ? `${color}15` : 'transparent', color }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>{label}</button>
  );
  return (
    <button onClick={onClick} style={{ ...base, border: 'none', background: hovered ? `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` : `${color}15`, color: hovered ? '#fff' : color, boxShadow: hovered ? `0 2px 10px ${color}35` : 'none' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>{label}</button>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function FraudAlerts() {
  const [alerts,        setAlerts]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('all');
  const [expanded,      setExpanded]      = useState(null);
  const [modal,         setModal]         = useState(null);
  const [modalAction,   setModalAction]   = useState('');
  const [notes,         setNotes]         = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [chainStatus,   setChainStatus]   = useState(null);  // 🔗

  injectAnim();

  const load = useCallback(async () => {
    try {
      const d = await bankAPI.getFraudAlerts({ status: filter });
      setAlerts(d.alerts || []);
    } catch (e) { console.error('FraudAlerts:', e); }
    finally { setLoading(false); }
  }, [filter]);

  // 🔗 Fetch blockchain status once on mount
  useEffect(() => {
    bankAPI.getBlockchainStatus().then(d => setChainStatus(d.blockchain)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const s = getSocket();
    if (s) { s.on('fraud-alert-update', load); return () => s.off('fraud-alert-update', load); }
  }, [load]);

  const handleAction = async () => {
    if (!modal) return;
    setActionLoading(true);
    try {
      const uid = modal.userId?._id;
      if      (modalAction === 'approve') await bankAPI.approveUser(uid, notes);
      else if (modalAction === 'unblock') await bankAPI.unblockUser(uid, notes);
      else if (modalAction === 'block')   await bankAPI.blockUser(uid, notes);
      else if (modalAction === 'monitor') await bankAPI.increaseMonitoring(uid, notes);
      setModal(null); setNotes(''); setModalAction('');
      await load();
    } catch (e) { alert(e.message || 'Action failed'); }
    setActionLoading(false);
  };

  const ACTION_META = {
    approve: { label: 'Approve Account',     color: '#059669', dangerStyle: false, desc: 'Clear this account. Decision logged immutably on Ethereum Sepolia.' },
    unblock: { label: 'Restore Access',      color: '#059669', dangerStyle: false, desc: 'Unblock this account. Decision logged on-chain.' },
    block:   { label: 'Suspend Permanently', color: '#DC2626', dangerStyle: true,  desc: 'Permanently suspend this account. Action written to blockchain for compliance.' },
    monitor: { label: 'Elevate Monitoring',  color: '#D97706', dangerStyle: false, desc: 'Place under enhanced monitoring. Logged on Sepolia.' },
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1100px' }}>
          <div style={{ marginBottom: '28px' }}><Shimmer h="26px" radius="8px" /><div style={{ height: '8px' }} /><Shimmer h="14px" radius="6px" /></div>
          {[1,2,3].map(i => <div key={i} style={{ marginBottom: '12px' }}><Shimmer h="84px" /></div>)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1100px', animation: 'fraudFadeUp 0.4s ease both' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A1F2E', letterSpacing: '-0.5px' }}>
                Fraud Alerts
              </h2>
              {alerts.some(a => a.alertLevel === 'critical' || a.status === 'pending') && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#DC2626', animation: 'fraudPulse 1.8s ease-in-out infinite' }} />
                  Active
                </span>
              )}

              {/* 🔗 Blockchain status pill */}
              {chainStatus && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '10px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px',
                  background: chainStatus.enabled ? 'rgba(139,92,246,0.08)' : 'rgba(100,116,139,0.08)',
                  color: chainStatus.enabled ? '#7C3AED' : '#64748B',
                  border: `1px solid ${chainStatus.enabled ? 'rgba(139,92,246,0.2)' : 'rgba(100,116,139,0.15)'}`,
                }}>
                  ⛓ {chainStatus.enabled ? `Sepolia · ${chainStatus.totalEvents} events` : 'Chain offline'}
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#64748B' }}>
              Per-account fraud monitoring — {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
              {chainStatus?.enabled && <span style={{ marginLeft: '8px', color: '#94A3B8' }}>· All actions logged on Ethereum Sepolia</span>}
            </p>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(15,23,42,0.04)', padding: '4px', borderRadius: '12px' }}>
            {['all', 'pending', 'monitoring', 'auto_blocked', 'approved'].map(s => (
              <FilterTab key={s} label={s} active={filter === s} onClick={() => setFilter(s)} />
            ))}
          </div>
        </div>

        {/* ── Alert list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map(alert => {
            const u      = alert.userId || {};
            const isOpen = expanded === alert._id;
            const lvl    = LEVEL_CONFIG[alert.alertLevel] || LEVEL_CONFIG.medium;
            const st     = STATUS_CONFIG[alert.status]    || STATUS_CONFIG.pending;
            const isBlocked = u.status === 'blocked' || alert.status === 'auto_blocked';

            return (
              <div key={alert._id} style={{
                background: '#fff',
                border: `1px solid rgba(15,23,42,0.08)`,
                borderLeft: `3px solid ${lvl.color}`,
                borderRadius: '14px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.03)',
                overflow: 'hidden', transition: 'box-shadow 0.2s ease',
              }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.05)'; }}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.03)'}
              >
                {/* Alert header */}
                <div
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'center' }}
                  onClick={() => setExpanded(isOpen ? null : alert._id)}
                >
                  <ScoreRing score={alert.fraudScore || 0} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#1A1F2E' }}>{u.name || 'Unknown Account'}</span>
                      <Pill label={alert.status} color={st.color} bg={st.bg} />
                      <Pill label={alert.alertLevel} color={lvl.color} bg={lvl.bg} />
                      {u.status && (
                        <Pill
                          label={u.status}
                          color={u.status === 'blocked' ? '#DC2626' : u.status === 'flagged' ? '#D97706' : '#059669'}
                          bg={u.status === 'blocked' ? 'rgba(220,38,38,0.08)' : u.status === 'flagged' ? 'rgba(217,119,6,0.08)' : 'rgba(5,150,105,0.08)'}
                        />
                      )}

                      {/* 🔗 Chain proof mini-badge */}
                      {alert.chainEventId && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px',
                          background: 'rgba(139,92,246,0.08)', color: '#7C3AED',
                          border: '1px solid rgba(139,92,246,0.2)',
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                        }}>⛓ #{alert.chainEventId}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginBottom: alert.fraudReason ? '5px' : 0 }}>
                      {u.email}
                    </div>
                    {alert.fraudReason && (
                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{alert.fraudReason}</div>
                    )}
                  </div>

                  <div style={{
                    flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px',
                    background: 'rgba(15,23,42,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(15,23,42,0.07)', padding: '20px', animation: 'fraudExpand 0.2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>

                      {/* ML reasons */}
                      <InfoBlock title="ML Detection">
                        {(alert.fraudReasons || []).length === 0
                          ? <div style={{ fontSize: '12px', color: '#94A3B8' }}>No reasons recorded</div>
                          : (alert.fraudReasons || []).map((r, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '5px', lineHeight: 1.5 }}>
                              <span style={{ color: '#DC2626', flexShrink: 0 }}>—</span>{r}
                            </div>
                          ))
                        }
                      </InfoBlock>

                      {/* Device & location */}
                      <InfoBlock title="Device & Location">
                        <InlineStat label="IP Address" value={alert.locationInfo?.ip || '—'} />
                        <InlineStat label="City" value={alert.locationInfo?.city || '—'} />
                        <InlineStat label="Device ID" value={alert.deviceInfo?.deviceId?.slice(0, 12) || '—'} />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {alert.deviceInfo?.isNewDevice && <Pill label="New Device" color="#DC2626" bg="rgba(220,38,38,0.08)" />}
                          {alert.locationInfo?.impossibleTravel && <Pill label="Impossible Travel" color="#DC2626" bg="rgba(220,38,38,0.08)" />}
                        </div>
                      </InfoBlock>

                      {/* Velocity */}
                      <InfoBlock title="Transaction Velocity">
                        <InlineStat label="Last 5 min"    value={alert.velocitySnapshot?.last5Min    || 0} color={velColor(alert.velocitySnapshot?.last5Min    || 0, 3)} />
                        <InlineStat label="Last 1 hour"   value={alert.velocitySnapshot?.last1Hour   || 0} color={velColor(alert.velocitySnapshot?.last1Hour   || 0, 10)} />
                        <InlineStat label="Last 24 hours" value={alert.velocitySnapshot?.last24Hours || 0} />
                      </InfoBlock>
                    </div>

                    {/* Behaviour profile */}
                    {u.behaviorProfile && (
                      <div style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', gap: '28px', flexWrap: 'wrap', fontSize: '12px' }}>
                        <div><span style={{ color: '#94A3B8' }}>Avg transaction </span><span style={{ fontWeight: '700', color: '#1A1F2E', fontFamily: 'monospace' }}>₹{Math.round(u.behaviorProfile.avgTransactionAmount || 0).toLocaleString('en-IN')}</span></div>
                        <div><span style={{ color: '#94A3B8' }}>Total transactions </span><span style={{ fontWeight: '700', color: '#1A1F2E', fontFamily: 'monospace' }}>{u.behaviorProfile.totalTransactions || 0}</span></div>
                        <div><span style={{ color: '#94A3B8' }}>Flagged incidents </span><span style={{ fontWeight: '700', color: '#D97706', fontFamily: 'monospace' }}>{u.flaggedActivityCount || 0}</span></div>
                      </div>
                    )}

                    {/* Timeline */}
                    <InfoBlock title="Activity Timeline">
                      <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px', marginTop: '10px' }}>
                        {(alert.timeline || []).length === 0
                          ? <div style={{ fontSize: '12px', color: '#94A3B8' }}>No timeline events</div>
                          : [...(alert.timeline || [])].reverse().map((t, i, arr) => (
                            <TimelineItem key={i} {...t} isLast={i === arr.length - 1} />
                          ))
                        }
                      </div>
                    </InfoBlock>

                    {/* 🔗 Blockchain panel — renders here in every expanded alert */}
                    <BlockchainPanel alert={alert} />

                    {/* Action buttons */}
                    {alert.status !== 'approved' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(15,23,42,0.07)', flexWrap: 'wrap' }}>
                        {isBlocked
                          ? <ActionBtn label="Restore Access"     onClick={() => { setModal(alert); setModalAction('unblock');  setNotes(''); }} color="#059669" />
                          : <ActionBtn label="Approve Account"    onClick={() => { setModal(alert); setModalAction('approve');  setNotes(''); }} color="#059669" />
                        }
                        <ActionBtn label="Suspend Account"    onClick={() => { setModal(alert); setModalAction('block');    setNotes(''); }} color="#DC2626" danger />
                        <ActionBtn label="Elevate Monitoring" onClick={() => { setModal(alert); setModalAction('monitor'); setNotes(''); }} color="#D97706" ghost />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {alerts.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '14px', padding: '64px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(15,23,42,0.04)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1F2E', marginBottom: '4px' }}>All Clear</div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>No {filter === 'all' ? '' : filter.replace('_', ' ')} fraud alerts at this time</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Action Modal ══ */}
      {modal && modalAction && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', animation: 'fraudFadeUp 0.2s ease' }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div style={{ width: '100%', maxWidth: '460px', background: '#fff', borderRadius: '20px', boxShadow: '0 8px 32px rgba(15,23,42,0.18)', padding: '28px', animation: 'fraudModalIn 0.25s ease' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1A1F2E', marginBottom: '4px' }}>
                {ACTION_META[modalAction]?.label}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                {ACTION_META[modalAction]?.desc}
              </p>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Account</span>
                <span style={{ fontWeight: '600', color: '#1A1F2E' }}>{modal.userId?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Fraud Score</span>
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#DC2626' }}>{modal.fraudScore}</span>
              </div>
            </div>

            {/* 🔗 Blockchain notice */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px' }}>⛓</span>
              <p style={{ fontSize: '11px', color: '#7C3AED', lineHeight: 1.5, margin: 0 }}>
                This decision will be recorded immutably on <strong>Ethereum Sepolia</strong>. The action, timestamp and notes will be permanently logged on-chain.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
                Decision Notes (included in on-chain record)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add your decision notes for the on-chain audit trail..."
                style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: '1px solid rgba(15,23,42,0.12)', borderRadius: '10px', padding: '10px 13px', fontSize: '13px', color: '#1A1F2E', background: '#fff', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e  => e.target.style.borderColor = 'rgba(15,23,42,0.12)'}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setModal(null); setModalAction(''); }}
                style={{ fontSize: '13px', fontWeight: '500', padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(15,23,42,0.12)', background: 'transparent', color: '#64748B', cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                style={{
                  fontSize: '13px', fontWeight: '600', padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: ACTION_META[modalAction]?.dangerStyle
                    ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
                    : modalAction === 'monitor'
                      ? 'rgba(217,119,6,0.1)'
                      : 'linear-gradient(135deg, #1A1F2E 0%, #2D3748 100%)',
                  color: modalAction === 'monitor' ? '#D97706' : '#fff',
                  opacity: actionLoading ? 0.7 : 1,
                  boxShadow: actionLoading ? 'none' : ACTION_META[modalAction]?.dangerStyle ? '0 2px 8px rgba(220,38,38,0.25)' : '0 2px 8px rgba(26,31,46,0.25)',
                  transition: 'all 0.15s',
                }}
              >
                {actionLoading ? '⛓ Writing to chain…' : ACTION_META[modalAction]?.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
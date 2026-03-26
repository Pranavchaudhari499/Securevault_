import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI, transactionAPI } from '../../services/api';

/* ─── Helpers ─── */
const riskColor = (s) =>
  s >= 60 ? '#DC2626' : s >= 30 ? '#D97706' : '#059669';

const riskLabel = (s) =>
  s >= 60 ? 'High' : s >= 30 ? 'Medium' : 'Low';

const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const GATEWAY_COLORS = {
  allow:  { bg: 'rgba(5,150,105,0.08)',  text: '#059669', dot: '#059669' },
  block:  { bg: 'rgba(220,38,38,0.08)',  text: '#DC2626', dot: '#DC2626' },
  review: { bg: 'rgba(217,119,6,0.08)',  text: '#D97706', dot: '#D97706' },
};

const BANK_COLORS = {
  approved: { bg: 'rgba(5,150,105,0.08)',  text: '#059669' },
  rejected: { bg: 'rgba(220,38,38,0.08)',  text: '#DC2626' },
  pending:  { bg: 'rgba(59,130,246,0.08)', text: '#3B82F6' },
};

/* ─── Pill badge ─── */
function Pill({ label, bg, color, dot }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '20px',
      background: bg, color, fontSize: '11px', fontWeight: '600',
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

/* ─── Risk bar ─── */
function RiskBar({ score }) {
  const color = riskColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(15,23,42,0.06)', minWidth: '48px',
      }}>
        <div style={{
          height: '100%', borderRadius: '2px', background: color,
          width: `${Math.min(score, 100)}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: '700', color, fontVariantNumeric: 'tabular-nums', minWidth: '22px' }}>
        {score}
      </span>
    </div>
  );
}

/* ─── Detail row in modal ─── */
function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid rgba(15,23,42,0.06)',
    }}>
      <span style={{ fontSize: '12px', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '600', color: '#1A1F2E' }}>{value}</span>
    </div>
  );
}

/* ─── Loading animation injection ─── */
function injectAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vault-tx-anim')) return;
  const s = document.createElement('style');
  s.id = 'vault-tx-anim';
  s.textContent = `
    @keyframes txShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    @keyframes txFadeUp {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes txModalIn {
      from { opacity:0; transform:scale(0.97) translateY(8px); }
      to   { opacity:1; transform:scale(1)    translateY(0); }
    }
    @keyframes txOverlayIn {
      from { opacity:0; }
      to   { opacity:1; }
    }
    .tx-row { transition: background 0.15s ease; }
    .tx-row:hover { background: rgba(15,23,42,0.018) !important; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function BankTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading,setActionLoading]= useState(null);
  const [notes,        setNotes]        = useState('');
  const [modal,        setModal]        = useState(null);

  injectAnim();

  const load = () =>
    transactionAPI.getAll({ limit: 50 })
      .then(d => setTransactions(d.transactions || []))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handle = async (txId, action) => {
    setActionLoading(txId + action);
    try {
      if (action === 'approve') await bankAPI.approveTransaction(txId, notes);
      else await bankAPI.rejectTransaction(txId, notes);
      setModal(null); setNotes('');
      await load();
    } catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const pending = transactions.filter(
    t => t.bankDecision === 'pending' && t.gatewayDecision === 'review'
  );

  /* ── Loading state ── */
  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1100px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ height: '26px', width: '220px', borderRadius: '8px', background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'txShimmer 1.6s infinite', marginBottom: '8px' }} />
            <div style={{ height: '14px', width: '140px', borderRadius: '6px', background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'txShimmer 1.6s infinite' }} />
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: '56px', borderRadius: '10px', background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'txShimmer 1.6s infinite', marginBottom: '8px' }} />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1100px', animation: 'txFadeUp 0.4s ease both' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A1F2E', letterSpacing: '-0.5px', marginBottom: '3px' }}>
              Transaction Review
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>
              {pending.length > 0 ? `${pending.length} transaction${pending.length > 1 ? 's' : ''} awaiting your decision` : 'All transactions up to date'}
            </p>
          </div>

          {/* trust signal */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: '#64748B',
            padding: '7px 13px', borderRadius: '10px',
            background: '#fff', border: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            256-bit encrypted
          </div>
        </div>

        {/* ── Pending banner ── */}
        {pending.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.18)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#D97706', flexShrink: 0, animation: 'txShimmer 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '13px', color: '#D97706', fontWeight: '500' }}>
              {pending.length} transaction{pending.length > 1 ? 's' : ''} flagged by gateway — awaiting your decision
            </span>
          </div>
        )}

        {/* ── Table ── */}
        <div style={{
          background: '#fff',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  {['Account', 'Type', 'Amount', 'Risk', 'Gateway', 'Bank', 'Status', 'Date', ''].map((h, i) => (
                    <th key={h + i} style={{
                      padding: '11px 16px', textAlign: 'left',
                      fontSize: '10px', fontWeight: '700', color: '#64748B',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      background: 'rgba(15,23,42,0.02)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
                  const gStyle = GATEWAY_COLORS[tx.gatewayDecision] || GATEWAY_COLORS.review;
                  const bStyle = BANK_COLORS[tx.bankDecision]       || BANK_COLORS.pending;
                  const score  = tx.securityChecks?.overallRiskScore || 0;
                  const isPending = tx.bankDecision === 'pending' && tx.gatewayDecision === 'review';

                  return (
                    <tr key={tx._id} className="tx-row" style={{
                      borderBottom: idx < transactions.length - 1 ? '1px solid rgba(15,23,42,0.05)' : 'none',
                      background: isPending ? 'rgba(217,119,6,0.025)' : 'transparent',
                    }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1F2E', marginBottom: '1px' }}>
                          {tx.userId?.name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                          {tx.userId?.email}
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: '12px', color: '#64748B', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {tx.type?.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1F2E', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {tx.amount > 0 ? formatCurrency(tx.amount) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', minWidth: '100px' }}>
                        <div style={{ marginBottom: '3px', fontSize: '10px', color: riskColor(score), fontWeight: '700' }}>{riskLabel(score)}</div>
                        <RiskBar score={score} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Pill label={tx.gatewayDecision} bg={gStyle.bg} color={gStyle.text} dot={gStyle.dot} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Pill label={tx.bankDecision} bg={bStyle.bg} color={bStyle.text} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Pill
                          label={tx.status}
                          bg={tx.status === 'approved' ? 'rgba(5,150,105,0.08)' : tx.status === 'rejected' || tx.status === 'blocked' ? 'rgba(220,38,38,0.08)' : 'rgba(59,130,246,0.08)'}
                          color={tx.status === 'approved' ? '#059669' : tx.status === 'rejected' || tx.status === 'blocked' ? '#DC2626' : '#3B82F6'}
                        />
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {isPending && (
                          <button
                            onClick={() => { setModal(tx); setNotes(''); }}
                            style={{
                              fontSize: '11px', fontWeight: '600', padding: '6px 14px',
                              borderRadius: '8px', border: '1px solid rgba(15,23,42,0.12)',
                              background: '#fff', color: '#1A1F2E', cursor: 'pointer',
                              transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#1A1F2E'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1A1F2E'; }}
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {transactions.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '64px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ Review Modal ══ */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
            animation: 'txOverlayIn 0.2s ease',
          }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div style={{
            width: '100%', maxWidth: '480px',
            background: '#fff', borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
            padding: '28px',
            animation: 'txModalIn 0.25s ease',
          }}>

            {/* modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1A1F2E', marginBottom: '3px' }}>Review Transaction</h3>
                <p style={{ fontSize: '12px', color: '#64748B' }}>Verify the details below before making a decision</p>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ background: 'rgba(15,23,42,0.05)', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.05)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1F2E" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* details */}
            <div style={{ background: 'rgba(15,23,42,0.02)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid rgba(15,23,42,0.06)' }}>
              <DetailRow label="Account" value={modal.userId?.name} />
              <DetailRow label="Amount"  value={formatCurrency(modal.amount)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Risk Score</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '150px' }}>
                  <RiskBar score={modal.securityChecks?.overallRiskScore || 0} />
                </div>
              </div>
            </div>

            {/* ML flag reasons */}
            {modal.securityChecks?.mlReasons?.length > 0 && (
              <div style={{
                background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)',
                borderRadius: '12px', padding: '12px 14px', marginBottom: '16px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  ML Flag Reasons
                </div>
                {modal.securityChecks.mlReasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '4px', lineHeight: 1.5 }}>
                    <span style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }}>–</span>
                    {r}
                  </div>
                ))}
              </div>
            )}

            {/* notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
                Decision Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for audit trail..."
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'none',
                  border: '1px solid rgba(15,23,42,0.12)', borderRadius: '10px',
                  padding: '10px 13px', fontSize: '13px', color: '#1A1F2E',
                  background: '#fff', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e  => e.target.style.borderColor = 'rgba(15,23,42,0.12)'}
              />
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal(null)}
                style={{
                  fontSize: '13px', fontWeight: '500', padding: '9px 18px',
                  borderRadius: '10px', border: '1px solid rgba(15,23,42,0.12)',
                  background: 'transparent', color: '#64748B', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,23,42,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={() => handle(modal._id, 'reject')}
                disabled={!!actionLoading}
                style={{
                  fontSize: '13px', fontWeight: '600', padding: '9px 18px',
                  borderRadius: '10px', border: '1px solid rgba(220,38,38,0.2)',
                  background: 'rgba(220,38,38,0.06)', color: '#DC2626', cursor: 'pointer',
                  transition: 'all 0.15s', opacity: actionLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!actionLoading) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff'; }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.color = '#DC2626'; }}
              >
                Reject
              </button>
              <button
                onClick={() => handle(modal._id, 'approve')}
                disabled={!!actionLoading}
                style={{
                  fontSize: '13px', fontWeight: '600', padding: '9px 18px',
                  borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #1A1F2E 0%, #2D3748 100%)',
                  color: '#fff', cursor: 'pointer',
                  transition: 'all 0.15s', opacity: actionLoading ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(26,31,46,0.25)',
                }}
                onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,31,46,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,31,46,0.25)'; }}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
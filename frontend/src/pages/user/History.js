import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI } from '../../services/api';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
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

const statusConfig = {
  approved:   { color: T.green,  bg: T.greenDim, dot: T.green,  icon: '+' },
  blocked:    { color: T.red,    bg: T.redDim,   dot: T.red,    icon: 'x' },
  flagged:    { color: T.amber,  bg: T.amberDim, dot: T.amber,  icon: '!' },
  processing: { color: T.blue,   bg: T.blueDim,  dot: T.blue,   icon: 'o' },
  rejected:   { color: T.red,    bg: T.redDim,   dot: T.red,    icon: 'x' },
  pending:    { color: T.blue,   bg: T.blueDim,  dot: T.blue,   icon: '.' },
  frozen:     { color: T.blue,   bg: T.blueDim,  dot: T.blue,   icon: '#' },
};

const riskColor = (s) => s >= 60 ? T.red : s >= 30 ? T.amber : T.green;

const FILTERS = ['all', 'approved', 'flagged', 'blocked', 'frozen'];

/* ─── Sub-components ────────────────────────────────────────────────────── */
function Skeleton({ h = 60 }) {
  return (
    <div style={{
      height: h,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
      borderBottom: `1px solid ${T.border}`,
    }} />
  );
}

function Badge({ status }) {
  const m = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '10px', fontWeight: '500', fontFamily: T.mono,
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}22`,
      borderRadius: '5px', padding: '2px 7px',
      textTransform: 'capitalize',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.dot }} />
      {status}
    </span>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function History() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    transactionAPI.getMy()
      .then(d => setTransactions(d.transactions || []))
      .catch(e => console.error('History error:', e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? transactions.length : transactions.filter(t => t.status === f).length;
    return acc;
  }, {});

  return (
    <Layout>
      <div style={{ maxWidth: '900px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '24px', animation: 'fadeUp .3s ease both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '600', color: T.text, letterSpacing: '-0.4px', marginBottom: '2px' }}>
                Transaction History
              </h2>
              <p style={{ fontSize: '13px', color: T.text3 }}>
                {filtered.length} records{filter !== 'all' ? ` · filtered by ${filter}` : ''}
              </p>
            </div>

            {/* trust pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: '99px', padding: '6px 14px',
              fontSize: '11px', color: T.text3,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontFamily: T.mono, color: T.text3 }}>Vault Protected</span>
            </div>
          </div>

          {/* ── Filter tabs ── */}
          <div style={{
            display: 'flex', gap: '2px', flexWrap: 'wrap',
            background: T.bg2, padding: '4px', borderRadius: '10px',
            border: `1px solid ${T.border}`, width: 'fit-content',
          }}>
            {FILTERS.map(s => {
              const active = filter === s;
              const cfg = statusConfig[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    background: active ? T.bg : 'transparent',
                    border: active ? `1px solid ${T.border}` : '1px solid transparent',
                    borderRadius: '7px',
                    padding: '5px 12px',
                    color: active ? T.text : T.text3,
                    fontSize: '12px', fontWeight: active ? '500' : '400',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s ease',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    textTransform: 'capitalize',
                    boxShadow: active ? T.shadow : 'none',
                  }}
                >
                  {s !== 'all' && cfg && (
                    <span style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: active ? cfg.dot : T.text4,
                      display: 'inline-block', flexShrink: 0,
                      transition: 'background .15s',
                    }} />
                  )}
                  {s}
                  <span style={{
                    fontSize: '10px', fontFamily: T.mono,
                    color: active ? T.text3 : T.text4,
                    background: active ? T.bg2 : 'transparent',
                    padding: '1px 5px', borderRadius: '4px',
                    transition: 'all .15s',
                  }}>
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table / skeleton / empty ── */}
        {loading ? (
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, overflow: 'hidden',
            boxShadow: T.shadow,
          }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} />)}
          </div>
        ) : (
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, overflow: 'hidden',
            boxShadow: T.shadow,
            animation: 'fadeUp .35s ease .1s both',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '72px', textAlign: 'center', color: T.text4 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block', opacity: .5 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <div style={{ fontSize: '14px', fontWeight: '500', color: T.text3, marginBottom: '4px' }}>No transactions found</div>
                <div style={{ fontSize: '12px' }}>Try changing the filter above</div>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.5fr 80px 90px 130px',
                  padding: '11px 22px',
                  borderBottom: `1px solid ${T.border}`,
                  background: T.bg2,
                }}>
                  {['Transaction', 'Amount', 'Recipient', 'Risk', 'Status', 'Date'].map(h => (
                    <span key={h} style={{
                      fontSize: '10px', fontWeight: '500', color: T.text4,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      fontFamily: T.mono,
                    }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Table rows */}
                {filtered.map((tx, i) => {
                  const cfg = statusConfig[tx.status] || statusConfig.pending;
                  const risk = tx.securityChecks?.overallRiskScore || 0;
                  return (
                    <div
                      key={tx._id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1.5fr 80px 90px 130px',
                        padding: '14px 22px',
                        borderBottom: `1px solid ${T.border}`,
                        alignItems: 'center',
                        transition: 'background .12s',
                        animation: `fadeUp 0.25s ease ${i * 0.03}s both`,
                        cursor: 'default',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = T.bgHov}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Transaction type */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '8px',
                          background: cfg.bg,
                          border: `1px solid ${cfg.color}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: '700', color: cfg.color,
                          fontFamily: T.mono, flexShrink: 0,
                        }}>
                          {cfg.icon}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: T.text, textTransform: 'capitalize' }}>
                          {tx.type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Amount */}
                      <span style={{
                        fontFamily: T.mono, fontWeight: '600', fontSize: '13px',
                        letterSpacing: '-0.3px', color: tx.amount > 0 ? T.text : T.text4,
                      }}>
                        {tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '—'}
                      </span>

                      {/* Recipient */}
                      <span style={{ fontSize: '11px', color: T.text3, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.recipientUpi || tx.recipientAccount || '—'}
                      </span>

                      {/* Risk */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '28px', height: '3px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${risk}%`, height: '100%',
                            background: riskColor(risk), borderRadius: '2px',
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', fontFamily: T.mono, fontWeight: '600', color: riskColor(risk) }}>
                          {risk}
                        </span>
                      </div>

                      {/* Status */}
                      <Badge status={tx.status} />

                      {/* Date */}
                      <span style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono, whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
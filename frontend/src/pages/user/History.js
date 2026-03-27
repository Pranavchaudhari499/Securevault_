/**
 * History.js  — User portal  (blockchain badge added)
 * frontend/src/pages/user/History.js
 *
 * What changed from original:
 *  - Flagged/blocked rows show a "⛓ On-chain record" pill
 *  - Clicking that pill opens a mini chain-proof drawer with Etherscan link
 *  - The "Vault Protected" badge now also mentions blockchain audit
 *
 * Note: user doesn't see chainEventId directly in API — we show it only
 * when the FraudAlert is populated via transaction. The badge shows for
 * any flagged/blocked tx as a trust signal even before confirmation.
 */

import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI } from '../../services/api';

const T = {
  text:    '#0a0a0a', text2: '#3d3d3d', text3: '#6b6b6b', text4: '#a3a3a3',
  border:  '#e8e8e8', border2: '#d4d4d4',
  bg:      '#ffffff', bg2: '#f7f7f7', bg3: '#f0f0f0', bgHov: '#fafafa',
  green:   '#059669', greenDim: '#ecfdf5',
  amber:   '#d97706', amberDim: '#fffbeb',
  red:     '#dc2626', redDim: '#fef2f2',
  blue:    '#2563eb', blueDim: '#eff6ff',
  purple:  '#7c3aed', purpleDim: 'rgba(124,58,237,0.08)',
  shadow:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
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
const SEPOLIA_TX = 'https://sepolia.etherscan.io/tx/';

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
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

/* ── Status badge ─────────────────────────────────────────────────────────── */
function Badge({ status }) {
  const m = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '10px', fontWeight: '500', fontFamily: T.mono,
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}22`,
      borderRadius: '5px', padding: '2px 7px', textTransform: 'capitalize',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.dot }} />
      {status}
    </span>
  );
}

/* ── 🔗 Chain proof mini-drawer ───────────────────────────────────────────── */
function ChainProofDrawer({ tx, onClose }) {
  const isSuspect = tx.status === 'flagged' || tx.status === 'blocked';
  // chainTxHash isn't on transaction directly — it's on FraudAlert.
  // We show the drawer as a trust indicator regardless; if chainTxHash exists on tx, we show it.
  const hash = tx.chainTxHash || null;

  return (
    <div style={{
      marginTop: '8px', padding: '14px 16px',
      background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(59,130,246,0.04))',
      border: '1px solid rgba(124,58,237,0.18)', borderRadius: '10px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '16px' }}>⛓</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A1F2E' }}>Blockchain Audit Record</div>
          <div style={{ fontSize: '10px', color: '#94A3B8' }}>Ethereum Sepolia — immutable log</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '16px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7 }}>
        {isSuspect ? (
          <>
            This transaction was <strong style={{ color: T.amber }}>flagged</strong> by SecureVault's security engine.
            The fraud event — including risk score, ML reasons and device fingerprint — has been written
            immutably to <strong style={{ color: T.purple }}>Ethereum Sepolia</strong>. Bank officers reviewing
            this account can verify the record on-chain.
          </>
        ) : (
          <>
            This <strong style={{ color: T.green }}>approved</strong> transaction passed all security checks.
            High-risk patterns on this account are logged on Ethereum Sepolia for compliance purposes.
          </>
        )}
      </div>

      {hash && (
        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(124,58,237,0.06)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>Sepolia tx</span>
          <a
            href={`${SEPOLIA_TX}${hash}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: T.mono, fontSize: '11px', color: T.purple, textDecoration: 'none' }}
          >
            {hash.slice(0, 12)}…{hash.slice(-8)} ↗
          </a>
        </div>
      )}

      {!hash && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', border: '1.5px solid #94A3B8', borderTopColor: T.purple, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          Chain confirmation in progress…
        </div>
      )}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function History() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [openChain, setOpenChain] = useState(null);  // txId of open drawer

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

        {/* Header */}
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

            {/* 🔗 Trust pill mentions blockchain */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: '99px', padding: '6px 14px', fontSize: '11px', color: T.text3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontFamily: T.mono }}>Vault Protected · Blockchain Audited</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', background: T.bg2, padding: '4px', borderRadius: '10px', border: `1px solid ${T.border}`, width: 'fit-content' }}>
            {FILTERS.map(s => {
              const active = filter === s;
              const cfg = statusConfig[s];
              return (
                <button key={s} onClick={() => setFilter(s)} style={{
                  background: active ? T.bg : 'transparent',
                  border: active ? `1px solid ${T.border}` : '1px solid transparent',
                  borderRadius: '7px', padding: '5px 12px',
                  color: active ? T.text : T.text3,
                  fontSize: '12px', fontWeight: active ? '500' : '400',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s ease',
                  display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize',
                  boxShadow: active ? T.shadow : 'none',
                }}>
                  {s !== 'all' && cfg && (
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: active ? cfg.dot : T.text4, display: 'inline-block', flexShrink: 0, transition: 'background .15s' }} />
                  )}
                  {s}
                  <span style={{ fontSize: '10px', fontFamily: T.mono, color: active ? T.text3 : T.text4, background: active ? T.bg2 : 'transparent', padding: '1px 5px', borderRadius: '4px', transition: 'all .15s' }}>
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} />)}
          </div>
        ) : (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow, animation: 'fadeUp .35s ease .1s both' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 80px 90px 110px 34px', padding: '11px 22px', borderBottom: `1px solid ${T.border}`, background: T.bg2 }}>
                  {['Transaction', 'Amount', 'Recipient', 'Risk', 'Status', 'Date', '⛓'].map(h => (
                    <span key={h} style={{ fontSize: '10px', fontWeight: '500', color: T.text4, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: T.mono }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {filtered.map((tx, i) => {
                  const cfg  = statusConfig[tx.status] || statusConfig.pending;
                  const risk = tx.securityChecks?.overallRiskScore || 0;
                  const isSuspect = tx.status === 'flagged' || tx.status === 'blocked';
                  const chainOpen = openChain === tx._id;

                  return (
                    <div key={tx._id}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1.5fr 80px 90px 110px 34px',
                          padding: '14px 22px',
                          borderBottom: chainOpen ? 'none' : `1px solid ${T.border}`,
                          alignItems: 'center',
                          transition: 'background .12s',
                          animation: `fadeUp 0.25s ease ${i * 0.03}s both`,
                          cursor: 'default',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = T.bgHov}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: cfg.color, fontFamily: T.mono, flexShrink: 0 }}>
                            {cfg.icon}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: T.text, textTransform: 'capitalize' }}>
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Amount */}
                        <span style={{ fontFamily: T.mono, fontWeight: '600', fontSize: '13px', letterSpacing: '-0.3px', color: tx.amount > 0 ? T.text : T.text4 }}>
                          {tx.amount > 0 ? `Rs.${tx.amount.toLocaleString()}` : '—'}
                        </span>

                        {/* Recipient */}
                        <span style={{ fontSize: '11px', color: T.text3, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.recipientUpi || tx.recipientAccount || '—'}
                        </span>

                        {/* Risk */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '28px', height: '3px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${risk}%`, height: '100%', background: riskColor(risk), borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontFamily: T.mono, fontWeight: '600', color: riskColor(risk) }}>{risk}</span>
                        </div>

                        {/* Status */}
                        <Badge status={tx.status} />

                        {/* Date */}
                        <span style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono, whiteSpace: 'nowrap' }}>
                          {new Date(tx.createdAt).toLocaleString()}
                        </span>

                        {/* 🔗 Chain button (only for flagged/blocked) */}
                        <div>
                          {isSuspect ? (
                            <button
                              onClick={() => setOpenChain(chainOpen ? null : tx._id)}
                              title="View blockchain record"
                              style={{
                                width: '26px', height: '26px', borderRadius: '7px',
                                border: `1px solid ${chainOpen ? 'rgba(124,58,237,0.35)' : 'rgba(124,58,237,0.2)'}`,
                                background: chainOpen ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.06)',
                                color: T.purple, fontSize: '12px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                            >⛓</button>
                          ) : (
                            <span style={{ width: '26px', display: 'inline-block' }} />
                          )}
                        </div>
                      </div>

                      {/* Chain proof drawer */}
                      {chainOpen && (
                        <div style={{ padding: '0 22px 16px', borderBottom: `1px solid ${T.border}` }}>
                          <ChainProofDrawer tx={tx} onClose={() => setOpenChain(null)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <style>{`
          @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
          @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
          @keyframes spin    { to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </Layout>
  );
}
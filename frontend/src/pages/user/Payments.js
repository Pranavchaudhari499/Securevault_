import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI, userAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

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

/* ─── Injected styles ───────────────────────────────────────────────────── */
const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes checkDraw { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }
  @keyframes flowPulse { 0%,100%{opacity:.25} 50%{opacity:1} }

  .sv-input {
    width: 100%;
    padding: 10px 13px;
    border: 1px solid ${T.border};
    border-radius: 8px;
    font-size: 13px;
    color: ${T.text};
    background: ${T.bg};
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color .15s, box-shadow .15s;
  }
  .sv-input:focus {
    border-color: ${T.blue};
    box-shadow: 0 0 0 3px ${T.blue}14;
  }
  .sv-input::placeholder { color: ${T.text4}; }
  .sv-select {
    width: 100%; padding: 10px 13px;
    border: 1px solid ${T.border}; border-radius: 8px;
    font-size: 13px; color: ${T.text}; background: ${T.bg};
    font-family: inherit; outline: none; cursor: pointer;
    transition: border-color .15s;
  }
  .sv-select:focus { border-color: ${T.blue}; }
  .sv-btn-primary {
    width: 100%; padding: 11px;
    background: ${T.text}; color: #fff;
    border: none; border-radius: 9px;
    font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: inherit;
    transition: opacity .15s, transform .15s;
    letter-spacing: .01em;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .sv-btn-primary:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
  .sv-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .sv-btn-ghost {
    width: 100%; padding: 9px;
    background: ${T.bg2}; color: ${T.text2};
    border: 1px solid ${T.border}; border-radius: 8px;
    font-size: 12px; font-weight: 500;
    cursor: pointer; font-family: inherit;
    transition: all .15s;
  }
  .sv-btn-ghost:hover { background: ${T.bg3}; border-color: ${T.border2}; }
  .sv-label {
    display: block; font-size: 11px; font-weight: 500;
    color: ${T.text3}; margin-bottom: 5px; letter-spacing: .01em;
  }
`;
if (!document.getElementById('sv-pay-styles')) {
  const s = document.createElement('style');
  s.id = 'sv-pay-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const riskColor = (s) => s >= 60 ? T.red : s >= 30 ? T.amber : T.green;

const statusMeta = {
  approved:   { color: T.green,  bg: T.greenDim, label: 'Approved'            },
  blocked:    { color: T.red,    bg: T.redDim,   label: 'Blocked'             },
  flagged:    { color: T.amber,  bg: T.amberDim, label: 'Flagged for Review'  },
  frozen:     { color: T.blue,   bg: T.blueDim,  label: 'Frozen'              },
  rejected:   { color: T.red,    bg: T.redDim,   label: 'Rejected'            },
  processing: { color: T.blue,   bg: T.blueDim,  label: 'Processing'          },
};

/* ─── CheckRow ──────────────────────────────────────────────────────────── */
function CheckRow({ label, passed, detail }) {
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '9px 0',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{
        width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
        background: passed ? T.greenDim : T.redDim,
        border: `1px solid ${passed ? T.green : T.red}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {passed ? (
          <svg width="8" height="8" viewBox="0 0 12 12">
            <polyline points="2,6 5,9 10,3"
              fill="none" stroke={T.green} strokeWidth="2"
              strokeDasharray="40" strokeDashoffset="0"
              style={{ animation: 'checkDraw .25s ease forwards' }}
            />
          </svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 10 10">
            <line x1="2" y1="2" x2="8" y2="8" stroke={T.red} strokeWidth="1.8" />
            <line x1="8" y1="2" x2="2" y2="8" stroke={T.red} strokeWidth="1.8" />
          </svg>
        )}
      </div>
      <div>
        <div style={{
          fontSize: '12px', fontWeight: '500',
          color: passed ? T.green : T.red,
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: T.text3, fontFamily: T.mono, lineHeight: 1.4 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

/* ─── FlowStep ──────────────────────────────────────────────────────────── */
function TransactionFlowIndicator({ status }) {
  const steps = ['Initiated', 'Gateway Check', 'Bank Processing', 'Complete'];
  const activeIdx = status === 'processing' ? 1
                  : status === 'approved'   ? 3
                  : status === 'blocked' || status === 'rejected' ? 2
                  : status === 'flagged'    ? 2 : 1;
  const failed = status === 'blocked' || status === 'rejected';

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {/* connector track */}
        <div style={{
          position: 'absolute', top: '11px', left: '11px',
          right: '11px', height: '1px',
          background: T.border, zIndex: 0,
        }} />

        {steps.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          const isFail  = failed && i === activeIdx;
          const color   = isFail ? T.red : done || current ? T.green : T.text4;

          return (
            <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1 }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: done ? T.green : current ? (isFail ? T.red : T.blue) : T.bg3,
                border: `1.5px solid ${done ? T.green : current ? (isFail ? T.red : T.blue) : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .3s ease',
                animation: current && !isFail ? 'flowPulse 1.5s ease infinite' : 'none',
              }}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 12 12">
                    <polyline points="2,6 5,9 10,3" fill="none" stroke="#fff" strokeWidth="2" />
                  </svg>
                ) : current && isFail ? (
                  <svg width="8" height="8" viewBox="0 0 10 10">
                    <line x1="2" y1="2" x2="8" y2="8" stroke="#fff" strokeWidth="1.8"/>
                    <line x1="8" y1="2" x2="2" y2="8" stroke="#fff" strokeWidth="1.8"/>
                  </svg>
                ) : (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: current ? '#fff' : T.border2 }} />
                )}
              </div>
              <span style={{
                fontSize: '9px', fontFamily: T.mono, color,
                textAlign: 'center', lineHeight: 1.2, maxWidth: '54px',
                fontWeight: current || done ? '500' : '400',
              }}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function Payments() {
  const [tab, setTab] = useState('upi');
  const [form, setForm] = useState({ recipientUpi: '', recipientAccount: '', amount: '', description: '', billType: 'electricity' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const d = await transactionAPI.getBalance();
      setBalance(d);
    } catch (e) { setBalance({ error: e.message }); }
    setBalanceLoading(false);
  };

  const handleSubmit = async () => {
    if (tab === 'balance') { fetchBalance(); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const typeMap = { upi: 'upi_payment', transfer: 'bank_transfer', bill: 'bill_payment', withdrawal: 'withdrawal' };
      const d = await transactionAPI.create({
        type: typeMap[tab],
        amount: form.amount,
        recipientUpi: form.recipientUpi,
        recipientAccount: form.recipientAccount,
        description: form.description,
      });
      setResult(d);
    } catch (e) { setError(e.message || 'Transaction failed'); }
    setLoading(false);
  };

  const tabs = [
    { id: 'upi',        label: 'UPI'       },
    { id: 'transfer',   label: 'Transfer'  },
    { id: 'bill',       label: 'Bill Pay'  },
    { id: 'withdrawal', label: 'Withdraw'  },
    { id: 'balance',    label: 'Balance'   },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: '840px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '24px', animation: 'fadeUp .3s ease both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '600', color: T.text, letterSpacing: '-0.4px', marginBottom: '2px' }}>
                Payments
              </h2>
              <p style={{ fontSize: '13px', color: T.text3 }}>
                Transactions are validated by the Vault Gateway security engine
              </p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: '99px', padding: '6px 14px',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontSize: '11px', fontFamily: T.mono, color: T.text3 }}>End-to-end encrypted</span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: '2px', marginBottom: '20px',
          background: T.bg2, padding: '4px', borderRadius: '10px',
          border: `1px solid ${T.border}`, width: 'fit-content', flexWrap: 'wrap',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(''); setBalance(null); }}
              style={{
                background: tab === t.id ? T.bg : 'transparent',
                border: tab === t.id ? `1px solid ${T.border}` : '1px solid transparent',
                borderRadius: '7px', padding: '6px 16px',
                color: tab === t.id ? T.text : T.text3,
                fontSize: '12px', fontWeight: tab === t.id ? '500' : '400',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .12s',
                boxShadow: tab === t.id ? T.shadow : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Balance tab ── */}
        {tab === 'balance' && (
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: T.radius, padding: '28px',
            boxShadow: T.shadow, maxWidth: '420px',
            animation: 'scaleIn .2s ease both',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: T.text, marginBottom: '20px' }}>
              Balance Enquiry
            </h3>
            {!balance && !balanceLoading && (
              <button className="sv-btn-primary" onClick={fetchBalance}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                Check Balance
              </button>
            )}
            {balanceLoading && (
              <div style={{ color: T.text3, textAlign: 'center', padding: '20px', fontSize: '13px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', border: `2px solid ${T.border}`, borderTopColor: T.blue, borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: '8px', verticalAlign: 'middle' }} />
                Fetching balance...
              </div>
            )}
            {balance && !balance.error && (
              <div style={{ animation: 'fadeIn .25s ease' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: T.text4, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Available Balance
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: '700', color: T.text, fontFamily: T.mono, letterSpacing: '-1.5px' }}>
                    Rs.{balance.balance?.toLocaleString()}
                  </div>
                </div>
                {balance.frozenBalance > 0 && (
                  <div style={{
                    background: T.amberDim, border: `1px solid ${T.amber}22`,
                    borderRadius: '8px', padding: '10px 14px',
                    marginBottom: '14px', fontSize: '12px', color: T.amber,
                    display: 'flex', gap: '8px', alignItems: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Rs.{balance.frozenBalance} frozen pending review
                  </div>
                )}
                <button className="sv-btn-ghost" onClick={() => setBalance(null)}>
                  Refresh
                </button>
              </div>
            )}
            {balance?.error && (
              <div style={{ color: T.red, fontSize: '12px', background: T.redDim, padding: '10px 12px', borderRadius: '7px' }}>
                {balance.error}
              </div>
            )}
          </div>
        )}

        {/* ── Payment forms ── */}
        {tab !== 'balance' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: result ? '1fr 1fr' : '1fr',
            gap: '16px',
            animation: 'fadeUp .3s ease .1s both',
          }}>

            {/* ── Form card ── */}
            <div style={{
              background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: T.radius, padding: '24px',
              boxShadow: T.shadow,
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: T.text, marginBottom: '20px' }}>
                {tab === 'upi' ? 'UPI Payment' : tab === 'transfer' ? 'Bank Transfer' : tab === 'bill' ? 'Bill Payment' : 'Withdrawal'}
              </h3>

              {error && (
                <div style={{
                  background: T.redDim, border: `1px solid ${T.red}20`,
                  borderRadius: '8px', padding: '10px 14px',
                  marginBottom: '16px', color: T.red, fontSize: '12px',
                  display: 'flex', gap: '8px', alignItems: 'flex-start',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(tab === 'upi' || tab === 'withdrawal') && (
                  <div>
                    <label className="sv-label">
                      {tab === 'withdrawal' ? 'UPI ID (source)' : 'Recipient UPI ID'}
                    </label>
                    <input
                      className="sv-input"
                      value={form.recipientUpi}
                      onChange={e => update('recipientUpi', e.target.value)}
                      placeholder="example@securevault"
                    />
                  </div>
                )}
                {tab === 'transfer' && (
                  <div>
                    <label className="sv-label">Account Number</label>
                    <input
                      className="sv-input"
                      value={form.recipientAccount}
                      onChange={e => update('recipientAccount', e.target.value)}
                      placeholder="10–16 digit account number"
                      maxLength={16}
                    />
                  </div>
                )}
                {tab === 'bill' && (
                  <div>
                    <label className="sv-label">Bill Type</label>
                    <select className="sv-select" value={form.billType} onChange={e => update('billType', e.target.value)}>
                      <option value="electricity">Electricity</option>
                      <option value="water">Water</option>
                      <option value="gas">Gas</option>
                      <option value="internet">Internet</option>
                      <option value="mobile">Mobile Recharge</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="sv-label">Amount (Rs.)</label>
                  <input
                    className="sv-input"
                    value={form.amount}
                    onChange={e => update('amount', e.target.value)}
                    type="number" min="1" placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="sv-label">Description (optional)</label>
                  <input
                    className="sv-input"
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder="Add a note"
                  />
                </div>
              </div>

              <button
                className="sv-btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                style={{ marginTop: '20px' }}
              >
                {loading ? (
                  <>
                    <span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Submit Transaction
                  </>
                )}
              </button>

              {/* Simulation presets */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '10px', color: T.text4, marginBottom: '8px', fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Simulation Presets
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Normal',      fn: () => { update('recipientUpi', 'friend@securevault'); update('amount', '500'); update('description', 'lunch'); } },
                    { label: 'Large',       fn: () => { update('amount', '75000'); update('recipientUpi', 'shop@securevault'); } },
                    { label: 'Rapid Fire',  fn: () => { update('recipientUpi', 'attack@securevault'); update('amount', '100'); update('description', 'test'); } },
                  ].map(({ label, fn }) => (
                    <button
                      key={label}
                      onClick={fn}
                      style={{
                        background: T.bg2, color: T.text3,
                        border: `1px solid ${T.border}`, borderRadius: '6px',
                        fontSize: '11px', padding: '5px 10px',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all .12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.bg3; e.currentTarget.style.color = T.text2; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.color = T.text3; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Result panel ── */}
            {result && (
              <div style={{
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: T.radius, padding: '24px',
                boxShadow: T.shadow,
                animation: 'scaleIn .22s ease both',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '500', color: T.text, marginBottom: '18px' }}>
                  Security Analysis
                </h3>

                {/* Status banner */}
                {(() => {
                  const txStatus = result.transaction?.status;
                  const s = statusMeta[txStatus] || { color: T.text3, bg: T.bg2, label: txStatus };
                  return (
                    <div style={{
                      background: s.bg,
                      border: `1px solid ${s.color}22`,
                      borderRadius: '10px', padding: '14px 16px',
                      marginBottom: '18px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: '600', color: s.color, letterSpacing: '-0.3px', marginBottom: '2px' }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: '11px', color: T.text3, fontFamily: T.mono }}>
                            {result.securityAnalysis?.gatewayDecision}
                          </div>
                        </div>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: `${s.color}14`,
                          border: `1.5px solid ${s.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {txStatus === 'approved' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : txStatus === 'blocked' || txStatus === 'rejected' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Flow indicator */}
                      <TransactionFlowIndicator status={txStatus} />
                    </div>
                  );
                })()}

                {/* Risk score */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '7px' }}>
                    <span style={{ color: T.text3, fontWeight: '500' }}>Risk Score</span>
                    <span style={{
                      fontFamily: T.mono, fontWeight: '600',
                      color: riskColor(result.securityAnalysis?.riskScore),
                    }}>
                      {result.securityAnalysis?.riskScore ?? 0}/100
                    </span>
                  </div>
                  <div style={{ height: '4px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${result.securityAnalysis?.riskScore ?? 0}%`,
                      height: '100%',
                      background: riskColor(result.securityAnalysis?.riskScore),
                      borderRadius: '2px',
                      transition: 'width .6s cubic-bezier(.22,1,.36,1)',
                    }} />
                  </div>
                </div>

                {/* New balance */}
                {result.userStatus && (
                  <div style={{
                    background: T.bg2, borderRadius: '8px',
                    padding: '10px 14px', marginBottom: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontSize: '11px', color: T.text3 }}>Updated Balance</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: T.mono, color: T.text }}>
                      Rs.{result.userStatus?.balance?.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Security checks */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', color: T.text4, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                    Gateway Checks
                  </div>
                  {Object.entries(result.securityAnalysis?.checks || {})
                    .filter(([k]) => k.endsWith('Check'))
                    .map(([k, v]) => (
                      <CheckRow
                        key={k}
                        label={k.replace('Check', '').replace(/([A-Z])/g, ' $1').trim()}
                        passed={v?.passed}
                        detail={v?.details || '—'}
                      />
                    ))}
                </div>

                {/* ML model */}
                <div style={{
                  background: '#7c3aed0a', border: '1px solid #7c3aed18',
                  borderRadius: '8px', padding: '11px 14px', marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600', marginBottom: '5px', fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    ML Model
                  </div>
                  <div style={{ fontSize: '12px', color: T.text2, fontFamily: T.mono }}>
                    Score: {((result.securityAnalysis?.checks?.mlAnomalyScore || 0) * 100).toFixed(0)}%
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    Decision: {result.securityAnalysis?.checks?.mlDecision || '—'}
                  </div>
                  {result.securityAnalysis?.mlReasons?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      {result.securityAnalysis.mlReasons.map((r, i) => (
                        <div key={i} style={{ fontSize: '11px', color: T.text3, marginTop: '2px', fontFamily: T.mono }}>
                          — {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Threat flags */}
                {result.securityAnalysis?.threatFlags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {result.securityAnalysis.threatFlags.map(f => (
                      <span key={f} style={{
                        fontSize: '10px', fontWeight: '500', fontFamily: T.mono,
                        color: T.red, background: T.redDim,
                        border: `1px solid ${T.red}20`,
                        borderRadius: '5px', padding: '2px 7px',
                      }}>
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
import React, { useState, useEffect } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI, userAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const CheckRow = ({ label, passed, detail }) => (
  <div style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: passed ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${passed ? 'rgba(34,197,94,0.3)' : 'rgba(244,63,94,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
      <span style={{ fontSize: '9px', color: passed ? 'var(--green)' : 'var(--red)', fontWeight: '700' }}>{passed ? 'P' : 'F'}</span>
    </div>
    <div>
      <div style={{ fontSize: '12px', fontWeight: '500', color: passed ? 'var(--green)' : 'var(--red)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', lineHeight: 1.4 }}>{detail}</div>
    </div>
  </div>
);

export default function Payments() {
  const [tab, setTab] = useState('upi');
  const [form, setForm] = useState({ recipientUpi: '', recipientAccount: '', amount: '', description: '' });
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
      const d = await transactionAPI.create({ type: typeMap[tab], amount: form.amount, recipientUpi: form.recipientUpi, recipientAccount: form.recipientAccount, description: form.description });
      setResult(d);
    } catch (e) { setError(e.message || 'Transaction failed'); }
    setLoading(false);
  };

  const statusMeta = {
    approved: { color: 'var(--green)', label: 'Approved' },
    blocked: { color: 'var(--red)', label: 'Blocked' },
    flagged: { color: 'var(--amber)', label: 'Flagged for Review' },
    frozen: { color: 'var(--blue)', label: 'Frozen - Pending Review' },
    rejected: { color: 'var(--red)', label: 'Rejected' },
    processing: { color: 'var(--blue)', label: 'Processing' }
  };

  const tabs = [
    { id: 'upi', label: 'UPI Payment' },
    { id: 'transfer', label: 'Bank Transfer' },
    { id: 'bill', label: 'Bill Payment' },
    { id: 'withdrawal', label: 'Withdrawal' },
    { id: 'balance', label: 'Balance' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: '840px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '4px' }}>Payments</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>All transactions are analyzed by SecureVault security engine</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-2)', padding: '4px', borderRadius: 'var(--radius)', width: 'fit-content', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError(''); setBalance(null); }}
              style={{ background: tab === t.id ? 'var(--bg-3)' : 'transparent', border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', padding: '6px 14px', color: tab === t.id ? 'var(--text)' : 'var(--text-3)', fontSize: '13px', fontWeight: tab === t.id ? '500' : '400', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.12s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Balance Tab */}
        {tab === 'balance' && (
          <div className="card" style={{ padding: '28px', maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '20px' }}>Balance Enquiry</h3>
            {!balance && !balanceLoading && (
              <button className="btn btn-primary" onClick={fetchBalance} style={{ width: '100%', padding: '11px' }}>Check Balance</button>
            )}
            {balanceLoading && <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px' }}>Fetching...</div>}
            {balance && !balance.error && (
              <div className="fade-in">
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>Available Balance</div>
                  <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text)', fontFamily: 'var(--mono)' }}>Rs.{balance.balance?.toLocaleString()}</div>
                </div>
                {balance.frozenBalance > 0 && (
                  <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: 'var(--amber)' }}>
                    Rs.{balance.frozenBalance} currently frozen pending review
                  </div>
                )}
                <button className="btn btn-ghost" onClick={() => setBalance(null)} style={{ width: '100%', fontSize: '12px', marginTop: '8px' }}>Check Again</button>
              </div>
            )}
            {balance?.error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{balance.error}</div>}
          </div>
        )}

        {/* Payment Forms */}
        {tab !== 'balance' && (
          <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ marginBottom: '18px' }}>
                {tab === 'upi' ? 'UPI Payment' : tab === 'transfer' ? 'Bank Transfer' : tab === 'bill' ? 'Bill Payment' : 'Withdrawal'}
              </h3>

              {error && <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: 'var(--red)', fontSize: '13px' }}>{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(tab === 'upi' || tab === 'withdrawal') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>
                      {tab === 'withdrawal' ? 'Debit from UPI (victim account)' : 'Recipient UPI ID'}
                    </label>
                    <input value={form.recipientUpi} onChange={e => update('recipientUpi', e.target.value)} placeholder="example@securevault" />
                  </div>
                )}
                {tab === 'transfer' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>Account Number</label>
                    <input value={form.recipientAccount} onChange={e => update('recipientAccount', e.target.value)} placeholder="10-16 digit account number" maxLength={16} />
                  </div>
                )}
                {tab === 'bill' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>Bill Type</label>
                    <select value={form.billType} onChange={e => update('billType', e.target.value)}>
                      <option value="electricity">Electricity</option>
                      <option value="water">Water</option>
                      <option value="gas">Gas</option>
                      <option value="internet">Internet</option>
                      <option value="mobile">Mobile Recharge</option>
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>Amount (Rs.)</label>
                  <input value={form.amount} onChange={e => update('amount', e.target.value)} type="number" min="1" placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '5px', fontWeight: '500' }}>Description</label>
                  <input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional note" />
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: '100%', marginTop: '18px', padding: '11px' }}>
                {loading ? 'Analyzing...' : 'Submit Transaction'}
              </button>

              {/* Demo buttons */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Simulation</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Normal', fn: () => { update('recipientUpi', 'friend@securevault'); update('amount', '500'); update('description', 'lunch'); } },
                    { label: 'Large Amount', fn: () => { update('amount', '75000'); update('recipientUpi', 'shop@securevault'); } },
                    { label: 'Rapid Fire', fn: () => { update('recipientUpi', 'attack@securevault'); update('amount', '100'); update('description', 'test'); } },
                  ].map(({ label, fn }) => (
                    <button key={label} className="btn" onClick={fn} style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', padding: '5px 10px' }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Panel */}
            {result && (
              <div className="card fade-in" style={{ padding: '22px' }}>
                <h3 style={{ marginBottom: '16px' }}>Security Analysis</h3>

                {/* Status */}
                {(() => {
                  const s = statusMeta[result.transaction?.status] || { color: 'var(--text-2)', label: result.transaction?.status };
                  return (
                    <div style={{ background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: '8px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, fontFamily: 'var(--mono)', marginBottom: '3px' }}>{s.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Gateway: {result.securityAnalysis?.gatewayDecision}</div>
                    </div>
                  );
                })()}

                {/* Risk */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-2)' }}>Risk Score</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: '600', color: result.securityAnalysis?.riskScore >= 60 ? 'var(--red)' : result.securityAnalysis?.riskScore >= 30 ? 'var(--amber)' : 'var(--green)' }}>
                      {result.securityAnalysis?.riskScore}/100
                    </span>
                  </div>
                  <div className="risk-bar">
                    <div className="risk-fill" style={{ width: `${result.securityAnalysis?.riskScore}%`, background: result.securityAnalysis?.riskScore >= 60 ? 'var(--red)' : result.securityAnalysis?.riskScore >= 30 ? 'var(--amber)' : 'var(--green)' }} />
                  </div>
                </div>

                {/* Balance update */}
                {result.userStatus && (
                  <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>New Balance</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'var(--mono)', color: 'var(--text)' }}>Rs.{result.userStatus?.balance?.toLocaleString()}</span>
                  </div>
                )}

                {/* Security Checks */}
                <div style={{ marginBottom: '12px' }}>
                  {Object.entries(result.securityAnalysis?.checks || {}).filter(([k]) => k.endsWith('Check')).map(([k, v]) => (
                    <CheckRow key={k} label={k.replace('Check', '').replace(/([A-Z])/g, ' $1').trim()} passed={v?.passed} detail={v?.details || '-'} />
                  ))}
                </div>

                {/* ML */}
                <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--purple)', fontWeight: '600', marginBottom: '4px', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>ML Model</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                    Score: {((result.securityAnalysis?.checks?.mlAnomalyScore || 0) * 100).toFixed(0)}% | Decision: {result.securityAnalysis?.checks?.mlDecision || '-'}
                  </div>
                  {result.securityAnalysis?.mlReasons?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      {result.securityAnalysis.mlReasons.map((r, i) => <div key={i} style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>- {r}</div>)}
                    </div>
                  )}
                </div>

                {/* Threat flags */}
                {result.securityAnalysis?.threatFlags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {result.securityAnalysis.threatFlags.map(f => (
                      <span key={f} className="badge badge-red" style={{ fontSize: '10px' }}>{f.replace(/_/g, ' ')}</span>
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
import React, { useCallback, useEffect, useState } from 'react';
import { transactionAPI } from '../../services/api';

function shortHash(hash) {
  if (!hash) return '-';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function statusStyle(valid) {
  if (valid === true) {
    return {
      color: '#166534',
      background: 'rgba(34,197,94,0.12)',
      border: '1px solid rgba(34,197,94,0.26)',
      label: 'Verified',
    };
  }
  if (valid === false) {
    return {
      color: '#b91c1c',
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.26)',
      label: 'Mismatch',
    };
  }
  return {
    color: '#475569',
    background: 'rgba(148,163,184,0.16)',
    border: '1px solid rgba(148,163,184,0.24)',
    label: 'Not Checked',
  };
}

export default function IntegrityTransactionsView({ role }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [verifyMap, setVerifyMap] = useState({});
  const [verifyingId, setVerifyingId] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, txRes] = await Promise.all([
        transactionAPI.getIntegritySummary(),
        role === 'user' ? transactionAPI.getMy() : transactionAPI.getAll({ page: 1, limit: 50 }),
      ]);
      setSummary(summaryRes?.integrity || null);
      setTransactions(txRes?.transactions || []);
    } catch (e) {
      console.error('IntegrityTransactionsView:', e);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(txId) {
    setVerifyingId(txId);
    try {
      const res = await transactionAPI.verifyIntegrity(txId);
      setVerifyMap((prev) => ({ ...prev, [txId]: res?.verification || { valid: false, reason: 'Unknown result' } }));
    } catch (e) {
      setVerifyMap((prev) => ({ ...prev, [txId]: { valid: false, reason: e?.message || 'Verification failed' } }));
    } finally {
      setVerifyingId(null);
    }
  }

  async function rebuild() {
    if (role === 'user') return;
    setRebuilding(true);
    try {
      await transactionAPI.rebuildIntegrity();
      await load();
    } catch (e) {
      console.error('rebuildIntegrity:', e);
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ marginBottom: '4px' }}>Transaction Integrity Ledger</h2>
        <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
          Tamper-evident DB hash chain for all transactions. Each record includes previous hash linkage.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Total Records</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{summary?.total ?? '-'}</div>
        </div>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Hash-Chained</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#1d4ed8' }}>{summary?.withIntegrity ?? '-'}</div>
        </div>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Coverage</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#166534' }}>{summary?.coverage != null ? `${summary.coverage}%` : '-'}</div>
        </div>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Latest Sequence</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{summary?.latestSequence ?? '-'}</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>Integrity Records</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {role !== 'user' && (
              <button
                onClick={rebuild}
                className="btn btn-ghost"
                style={{ fontSize: '11px', padding: '5px 9px' }}
                disabled={rebuilding}
              >
                {rebuilding ? 'Rebuilding...' : 'Rebuild Chain'}
              </button>
            )}
            <button onClick={load} className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 9px' }}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-3)' }}>Loading integrity records...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-3)' }}>No transactions found.</div>
        ) : (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {transactions.map((tx) => {
              const verification = verifyMap[tx._id];
              const chip = statusStyle(verification?.valid);
              return (
                <div key={tx._id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {tx.transactionId || tx._id}
                      <span style={{ marginLeft: '8px', color: 'var(--text-3)', fontWeight: 400, fontFamily: 'var(--mono)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', borderRadius: '12px', padding: '2px 8px', fontWeight: 700, ...chip }}>
                      {chip.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Sequence</div>
                      <div style={{ fontFamily: 'var(--mono)' }}>{tx.integrity?.sequence ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Prev Hash</div>
                      <div style={{ fontFamily: 'var(--mono)' }}>{shortHash(tx.integrity?.prevHash)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Current Hash</div>
                      <div style={{ fontFamily: 'var(--mono)' }}>{shortHash(tx.integrity?.currentHash)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Status</div>
                      <div style={{ textTransform: 'capitalize' }}>{tx.status}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '5px 9px' }}
                      onClick={() => verify(tx._id)}
                      disabled={verifyingId === tx._id}
                    >
                      {verifyingId === tx._id ? 'Verifying...' : 'Verify Hash'}
                    </button>
                    {verification?.reason && (
                      <span style={{ fontSize: '11px', color: verification.valid ? '#166534' : '#b91c1c' }}>
                        {verification.reason}
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
  );
}

/**
 * BlockchainVerify.js
 * Place in: frontend/src/components/BlockchainVerify.js
 *
 * Drop this component into your BankFraudAlerts page wherever you show
 * an individual alert's detail panel.
 *
 * Usage:
 *   <BlockchainVerify alert={selectedAlert} />
 *
 * Props:
 *   alert  — the FraudAlert document from your API
 *            Needs: alert.chainEventId, alert.chainTxHash
 */

import React, { useState } from 'react';
import { bankAPI } from '../utils/api';   // adjust path if needed

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

export default function BlockchainVerify({ alert }) {
  const [verifying, setVerifying] = useState(false);
  const [record,    setRecord]    = useState(null);
  const [error,     setError]     = useState(null);

  if (!alert) return null;

  const { chainEventId, chainTxHash } = alert;

  async function handleVerify() {
    if (!chainEventId) return;
    setVerifying(true);
    setError(null);
    setRecord(null);
    try {
      const res = await bankAPI.verifyOnChain(chainEventId);
      setRecord(res.record);
    } catch (e) {
      setError(e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  // Not yet written on-chain (blockchain may still be confirming)
  if (!chainEventId) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.iconGray}>⛓</span>
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Chain proof pending confirmation…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.iconGreen}>⛓</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>On-chain proof</span>
        <span style={styles.pill}>Sepolia</span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Chain event ID</span>
        <span style={styles.mono}>#{chainEventId}</span>
      </div>

      {chainTxHash && (
        <div style={styles.row}>
          <span style={styles.label}>Sepolia tx</span>
          <a
            href={`${SEPOLIA_EXPLORER}${chainTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            {chainTxHash.slice(0, 10)}…{chainTxHash.slice(-8)} ↗
          </a>
        </div>
      )}

      <button
        className="btn btn-ghost"
        style={{ marginTop: 10, fontSize: 12, width: '100%' }}
        onClick={handleVerify}
        disabled={verifying}
      >
        {verifying ? '⏳ Verifying…' : '🔍 Verify on-chain'}
      </button>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {record && (
        <div style={styles.result}>
          <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
            ✓ Verified on-chain
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Action</span>
            <span style={styles.mono}>{record.action}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Risk score</span>
            <span style={styles.mono}>{record.riskScore}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Reason</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 220, wordBreak: 'break-word' }}>{record.reason}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Timestamp</span>
            <span style={styles.mono}>{new Date(record.timestamp).toLocaleString()}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>DB hash</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)', wordBreak: 'break-all' }}>{record.txHash}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background:   'var(--bg-2)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding:      '14px 16px',
    marginTop:    12,
  },
  header: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    marginBottom: 10,
  },
  iconGreen: { fontSize: 16, color: 'var(--green)' },
  iconGray:  { fontSize: 16, color: 'var(--text-3)' },
  pill: {
    background:   'var(--amber-dim)',
    color:        'var(--amber)',
    border:       '1px solid rgba(217,119,6,0.2)',
    borderRadius: 6,
    fontSize:     11,
    fontWeight:   600,
    fontFamily:   'var(--mono)',
    padding:      '2px 7px',
    marginLeft:   'auto',
  },
  row: {
    display:       'flex',
    justifyContent:'space-between',
    alignItems:    'flex-start',
    padding:       '5px 0',
    borderBottom:  '1px solid var(--border)',
    gap:           8,
  },
  label: {
    fontSize:   12,
    color:      'var(--text-3)',
    flexShrink: 0,
  },
  mono: {
    fontFamily: 'var(--mono)',
    fontSize:   12,
    color:      'var(--text)',
  },
  link: {
    fontFamily: 'var(--mono)',
    fontSize:   12,
    color:      'var(--blue)',
    textDecoration: 'none',
  },
  error: {
    marginTop:    8,
    padding:      '6px 10px',
    background:   'var(--red-dim)',
    border:       '1px solid rgba(239,68,68,0.15)',
    borderRadius: 'var(--radius)',
    color:        'var(--red)',
    fontSize:     12,
  },
  result: {
    marginTop:    10,
    padding:      '10px 12px',
    background:   'var(--green-dim)',
    border:       '1px solid rgba(16,163,74,0.15)',
    borderRadius: 'var(--radius)',
  },
};
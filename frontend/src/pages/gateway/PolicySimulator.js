import React, { useMemo, useState } from 'react';
import Layout from '../../components/shared/Layout';
import { transactionAPI } from '../../services/api';
import { simulatePolicy } from '../../utils/policyEngine';

export default function PolicySimulator() {
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [mediumThreshold, setMediumThreshold] = useState(35);
  const [highThreshold, setHighThreshold] = useState(65);
  const [precisionFirst, setPrecisionFirst] = useState(true);
  const [strictNewDevice, setStrictNewDevice] = useState(false);

  const policy = useMemo(() => ({ mediumThreshold, highThreshold, precisionFirst, strictNewDevice }), [mediumThreshold, highThreshold, precisionFirst, strictNewDevice]);
  const simulation = useMemo(() => simulatePolicy(transactions, policy), [transactions, policy]);

  async function loadData() {
    setLoading(true);
    try {
      const d = await transactionAPI.getAll({ page: 1, limit: 200 });
      setTransactions(d.transactions || []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1180px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ marginBottom: '5px' }}>Policy Impact Simulator</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
            What-if analysis for policy changes: instantly shows which users and transactions would be affected, and why.
          </p>
        </div>

        <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <label style={{ fontSize: '12px' }}>
              <div style={{ color: 'var(--text-3)', marginBottom: '4px' }}>Medium threshold: {mediumThreshold}</div>
              <input type="range" min="20" max="60" value={mediumThreshold} onChange={(e) => setMediumThreshold(Number(e.target.value))} style={{ width: '100%' }} />
            </label>

            <label style={{ fontSize: '12px' }}>
              <div style={{ color: 'var(--text-3)', marginBottom: '4px' }}>High threshold: {highThreshold}</div>
              <input type="range" min="45" max="90" value={highThreshold} onChange={(e) => setHighThreshold(Number(e.target.value))} style={{ width: '100%' }} />
            </label>

            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-2)' }}>
              <input type="checkbox" checked={precisionFirst} onChange={(e) => setPrecisionFirst(e.target.checked)} />
              Precision-first mode
            </label>

            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-2)' }}>
              <input type="checkbox" checked={strictNewDevice} onChange={(e) => setStrictNewDevice(e.target.checked)} />
              Strict new-device monitor
            </label>

            <button onClick={loadData} className="btn btn-ghost" style={{ fontSize: '12px' }} disabled={loading}>
              {loading ? 'Running...' : loaded ? 'Re-run Simulation' : 'Run Simulation'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Transactions Analyzed</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{simulation.summary.total}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Policy Changes</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#b45309' }}>{simulation.summary.changed}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Users Affected</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#7c3aed' }}>{simulation.summary.changedUsers}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Action Mix</div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              Block: {simulation.summary.blockCount} | Monitor: {simulation.summary.monitorCount} | Allow: {simulation.summary.allowCount}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Affected Users</div>
            <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
              {!loaded ? (
                <div style={{ padding: '14px', color: 'var(--text-3)' }}>Run simulation to see impacted users.</div>
              ) : simulation.affectedUsers.length === 0 ? (
                <div style={{ padding: '14px', color: 'var(--text-3)' }}>No users affected by this policy.</div>
              ) : simulation.affectedUsers.map((u) => (
                <div key={u.uid} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{u.email}</div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '4px' }}>{u.count} transaction(s) impacted</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>{u.topReasons.join(' | ')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Changed Transactions and Reasons</div>
            <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
              {!loaded ? (
                <div style={{ padding: '14px', color: 'var(--text-3)' }}>Run simulation to view policy impact details.</div>
              ) : simulation.impacted.length === 0 ? (
                <div style={{ padding: '14px', color: 'var(--text-3)' }}>No transaction-level changes.</div>
              ) : simulation.impacted.map((row) => (
                <div key={row.tx._id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{row.tx.userId?.name || 'Unknown User'}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-3)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '12px', padding: '2px 7px' }}>
                      risk {row.tx.securityChecks?.overallRiskScore || 0}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{row.current.toUpperCase()} -></span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: row.proposed === 'block' ? '#b91c1c' : row.proposed === 'monitor' ? '#b45309' : '#166534' }}>
                      {row.proposed.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>{row.reasons.join(' | ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

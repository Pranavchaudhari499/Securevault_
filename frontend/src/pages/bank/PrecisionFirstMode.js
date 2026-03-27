import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { evaluateGuardrailRecommendation } from '../../utils/policyEngine';

function actionColor(action) {
  if (action === 'block') return '#b91c1c';
  if (action === 'monitor') return '#b45309';
  return '#166534';
}

export default function PrecisionFirstMode() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [precisionFirst, setPrecisionFirst] = useState(true);

  useEffect(() => {
    bankAPI.getFraudAlerts({ status: 'all' })
      .then((d) => setAlerts(d.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  const evaluated = useMemo(() => {
    return alerts.map((a) => ({
      alert: a,
      rec: evaluateGuardrailRecommendation(a, { precisionFirst }),
    }));
  }, [alerts, precisionFirst]);

  const guardrailCount = evaluated.filter((e) => e.rec.guardrailApplied).length;

  return (
    <Layout>
      <div style={{ maxWidth: '1180px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: '5px' }}>Precision-First Mode</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
              False-positive guardrail: medium-risk + clean behavior defaults to monitor instead of block.
            </p>
          </div>

          <button
            onClick={() => setPrecisionFirst((v) => !v)}
            className="btn btn-ghost"
            style={{ fontSize: '12px', padding: '8px 12px', borderColor: precisionFirst ? 'rgba(22,101,52,0.35)' : 'rgba(180,83,9,0.3)' }}
          >
            Precision-First: {precisionFirst ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Alerts Evaluated</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700 }}>{evaluated.length}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Guardrail Applied</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--mono)', fontWeight: 700, color: '#b45309' }}>{guardrailCount}</div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Mode Purpose</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>Reduce false positives</div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Recommendation Preview</div>
          {loading ? (
            <div style={{ padding: '20px 15px', color: 'var(--text-3)' }}>Loading...</div>
          ) : evaluated.length === 0 ? (
            <div style={{ padding: '20px 15px', color: 'var(--text-3)' }}>No alerts found.</div>
          ) : (
            <div style={{ maxHeight: '72vh', overflow: 'auto' }}>
              {evaluated.map(({ alert, rec }) => (
                <div key={alert._id} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '7px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{alert.userId?.name || 'Unknown User'}</span>
                    <span style={{ fontSize: '10px', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '12px', padding: '2px 8px', color: 'var(--text-3)' }}>
                      risk: {rec.risk}
                    </span>
                    {rec.guardrailApplied && (
                      <span style={{ fontSize: '10px', border: '1px solid rgba(180,83,9,0.3)', borderRadius: '12px', padding: '2px 8px', color: '#b45309', background: 'rgba(245,158,11,0.08)' }}>
                        guardrail applied
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Base Recommendation</div>
                      <div style={{ color: actionColor(rec.baseRecommendation), fontWeight: 700, textTransform: 'uppercase' }}>{rec.baseRecommendation}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Precision-First Recommendation</div>
                      <div style={{ color: actionColor(rec.finalRecommendation), fontWeight: 700, textTransform: 'uppercase' }}>{rec.finalRecommendation}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Why</div>
                      <div style={{ color: 'var(--text-2)' }}>{rec.reasons.join(' ')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

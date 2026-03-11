import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { bankAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const levelColor = { low: 'var(--blue)', medium: 'var(--amber)', high: 'var(--red)', critical: '#dc2626' };
const levelBadge = { low: 'blue', medium: 'amber', high: 'red', critical: 'red' };
const statusBadge = { pending: 'red', reviewed: 'blue', auto_blocked: 'red', approved: 'green', monitoring: 'amber' };

function TimelineItem({ event, timestamp, details, fraudScore }) {
  return (
    <div style={{ display: 'flex', gap: '12px', paddingBottom: '12px', position: 'relative' }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: fraudScore >= 60 ? 'var(--red)' : 'var(--amber)', marginTop: '3px' }} />
        <div style={{ width: '1px', flex: 1, background: 'var(--border)', marginTop: '4px' }} />
      </div>
      <div style={{ flex: 1, paddingBottom: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text)', marginBottom: '2px' }}>{event}</div>
        {details && <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.4 }}>{details}</div>}
        <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: '3px' }}>
          {new Date(timestamp).toLocaleString()}
          {fraudScore != null && <span style={{ marginLeft: '8px', color: fraudScore >= 60 ? 'var(--red)' : 'var(--amber)' }}>Score: {fraudScore}</span>}
        </div>
      </div>
    </div>
  );
}

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalAction, setModalAction] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await bankAPI.getFraudAlerts({ status: filter });
      setAlerts(d.alerts || []);
    } catch (e) { console.error('FraudAlerts:', e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const s = getSocket();
    if (s) { s.on('fraud-alert-update', load); return () => s.off('fraud-alert-update', load); }
  }, [load]);

  const handleAction = async () => {
    if (!modal) return;
    setActionLoading(true);
    try {
      const userId = modal.userId?._id;
      if (modalAction === 'approve') await bankAPI.approveUser(userId, notes);
      else if (modalAction === 'unblock') await bankAPI.unblockUser(userId, notes);
      else if (modalAction === 'block') await bankAPI.blockUser(userId, notes);
      else if (modalAction === 'monitor') await bankAPI.increaseMonitoring(userId, notes);
      setModal(null); setNotes(''); setModalAction('');
      await load();
    } catch (e) { alert(e.message || 'Action failed'); }
    setActionLoading(false);
  };

  const actionMeta = {
    approve: { label: 'Approve User', color: 'var(--green)', btnClass: 'btn-success', desc: 'Clear this user. Remove flagged status and reset risk score.' },
    unblock: { label: 'Unblock User', color: 'var(--green)', btnClass: 'btn-success', desc: 'Unblock this user and restore their account to active status.' },
    block: { label: 'Block Permanently', color: 'var(--red)', btnClass: 'btn-danger', desc: 'Permanently block this user. They will not be able to transact.' },
    monitor: { label: 'Increase Monitoring', color: 'var(--amber)', btnClass: '', desc: 'Place user under close observation. Transactions continue normally.' }
  };

  return (
    <Layout>
      <div style={{ maxWidth: '1100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ marginBottom: '2px' }}>Fraud Alerts</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Per-user fraud monitoring — {alerts.length} alerts</p>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-2)', padding: '4px', borderRadius: 'var(--radius)' }}>
            {['all', 'pending', 'monitoring', 'auto_blocked', 'approved'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ background: filter === s ? 'var(--bg-3)' : 'transparent', border: filter === s ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', padding: '5px 10px', color: filter === s ? 'var(--text)' : 'var(--text-3)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div style={{ padding: '40px', color: 'var(--text-3)' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.map(alert => {
              const u = alert.userId || {};
              const isOpen = expanded === alert._id;
              return (
                <div key={alert._id} className="card" style={{ borderLeft: `3px solid ${levelColor[alert.alertLevel] || 'var(--border)'}`, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'flex-start' }} onClick={() => setExpanded(isOpen ? null : alert._id)}>
                    {/* User info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{u.name || 'Unknown'}</span>
                        <span className={`badge badge-${statusBadge[alert.status] || 'blue'}`}>{alert.status?.replace('_', ' ')}</span>
                        <span className={`badge badge-${levelBadge[alert.alertLevel] || 'blue'}`}>{alert.alertLevel}</span>
                        {u.status && <span className={`badge badge-${u.status === 'blocked' ? 'red' : u.status === 'flagged' ? 'amber' : 'green'}`}>{u.status}</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>{u.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{alert.fraudReason}</div>
                    </div>

                    {/* Score + stats */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'var(--mono)', color: alert.fraudScore >= 60 ? 'var(--red)' : 'var(--amber)', lineHeight: 1 }}>{alert.fraudScore}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '6px' }}>fraud score</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{alert.suspiciousActivityCount} incidents</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(alert.updatedAt || alert.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }} className="fade-in">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        {/* ML Reasons */}
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>ML Detection Reasons</div>
                          {(alert.fraudReasons || []).map((r, i) => (
                            <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                              <span style={{ color: 'var(--red)', flexShrink: 0 }}>—</span>{r}
                            </div>
                          ))}
                          {(!alert.fraudReasons || alert.fraudReasons.length === 0) && <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No reasons recorded</div>}
                        </div>

                        {/* Device & Location */}
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Device & Location</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.8 }}>
                            <div>IP: <span style={{ fontFamily: 'var(--mono)' }}>{alert.locationInfo?.ip || '-'}</span></div>
                            <div>Location: {alert.locationInfo?.city || '-'}</div>
                            <div>Device: <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{alert.deviceInfo?.deviceId?.slice(0, 12) || '-'}</span></div>
                            {alert.deviceInfo?.isNewDevice && <span className="badge badge-red" style={{ fontSize: '10px' }}>New Device</span>}
                            {alert.locationInfo?.impossibleTravel && <span className="badge badge-red" style={{ fontSize: '10px', marginLeft: '4px' }}>Impossible Travel</span>}
                          </div>
                        </div>

                        {/* Velocity */}
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Transaction Velocity</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.8 }}>
                            <div>Last 5 min: <span style={{ fontFamily: 'var(--mono)', color: (alert.velocitySnapshot?.last5Min || 0) >= 3 ? 'var(--red)' : 'var(--text)' }}>{alert.velocitySnapshot?.last5Min || 0}</span></div>
                            <div>Last 1 hour: <span style={{ fontFamily: 'var(--mono)', color: (alert.velocitySnapshot?.last1Hour || 0) >= 10 ? 'var(--red)' : 'var(--text)' }}>{alert.velocitySnapshot?.last1Hour || 0}</span></div>
                            <div>Last 24 hours: <span style={{ fontFamily: 'var(--mono)' }}>{alert.velocitySnapshot?.last24Hours || 0}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* User behavior */}
                      {u.behaviorProfile && (
                        <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px' }}>
                          <div><span style={{ color: 'var(--text-3)' }}>Avg transaction: </span><span style={{ fontFamily: 'var(--mono)' }}>Rs.{Math.round(u.behaviorProfile.avgTransactionAmount || 0).toLocaleString()}</span></div>
                          <div><span style={{ color: 'var(--text-3)' }}>Total transactions: </span><span style={{ fontFamily: 'var(--mono)' }}>{u.behaviorProfile.totalTransactions || 0}</span></div>
                          <div><span style={{ color: 'var(--text-3)' }}>Flagged incidents: </span><span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{u.flaggedActivityCount || 0}</span></div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Activity Timeline</div>
                        <div style={{ maxHeight: '200px', overflow: 'auto', paddingRight: '8px' }}>
                          {(alert.timeline || []).slice().reverse().map((t, i) => (
                            <TimelineItem key={i} {...t} />
                          ))}
                          {(!alert.timeline || alert.timeline.length === 0) && <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No timeline events</div>}
                        </div>
                      </div>

                      {/* Actions */}
                      {alert.status !== 'approved' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                          {u.status === 'blocked' || alert.status === 'auto_blocked' ? (
                            <button className="btn btn-success" style={{ fontSize: '12px' }} onClick={() => { setModal(alert); setModalAction('unblock'); setNotes(''); }}>Unblock User</button>
                          ) : (
                            <button className="btn btn-success" style={{ fontSize: '12px' }} onClick={() => { setModal(alert); setModalAction('approve'); setNotes(''); }}>Approve User</button>
                          )}
                          <button className="btn btn-danger" style={{ fontSize: '12px' }} onClick={() => { setModal(alert); setModalAction('block'); setNotes(''); }}>Block Permanently</button>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.3)' }} onClick={() => { setModal(alert); setModalAction('monitor'); setNotes(''); }}>Increase Monitoring</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {alerts.length === 0 && (
              <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                No {filter === 'all' ? '' : filter} fraud alerts
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {modal && modalAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card fade-in" style={{ width: '460px', maxWidth: '100%', padding: '26px' }}>
            <h3 style={{ marginBottom: '4px' }}>{actionMeta[modalAction]?.label}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '16px' }}>{actionMeta[modalAction]?.desc}</p>
            <div style={{ background: 'var(--bg-2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-3)' }}>User: </span><span style={{ fontWeight: '500' }}>{modal.userId?.name}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: '16px' }}>Fraud Score: </span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--red)', fontWeight: '600' }}>{modal.fraudScore}</span>
            </div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', fontWeight: '500' }}>Notes / Reason</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add your decision notes..." style={{ marginBottom: '18px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setModal(null); setModalAction(''); }}>Cancel</button>
              <button className={`btn ${actionMeta[modalAction]?.btnClass || 'btn-ghost'}`} onClick={handleAction} disabled={actionLoading}
                style={modalAction === 'monitor' ? { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.2)' } : {}}>
                {actionLoading ? 'Processing...' : actionMeta[modalAction]?.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
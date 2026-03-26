import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const navConfigs = {
  user: [
    { path: '/dashboard', label: 'Overview', icon: GridIcon },
    { path: '/payments', label: 'Payments', icon: SendIcon },
    { path: '/history', label: 'History', icon: ClockIcon },
  ],
  gateway_admin: [
    { path: '/gateway', label: 'Overview', icon: GridIcon },
    { path: '/gateway/transactions', label: 'Live Transactions', icon: ActivityIcon },
    { path: '/gateway/users', label: 'Users', icon: UsersIcon },
  ],
  bank_officer: [
    { path: '/bank', label: 'Overview', icon: GridIcon },
    { path: '/bank/fraud-alerts', label: 'Fraud Alerts', icon: ShieldIcon },
    { path: '/bank/transactions', label: 'Transactions', icon: ActivityIcon },
    { path: '/bank/network-graph', label: 'Network Graph', icon: NetworkIcon },
  ]
};

const portalMeta = {
  user: { label: 'User Portal', color: '#4f6ef7', accent: 'var(--blue)' },
  gateway_admin: { label: 'API Vault', color: '#8b5cf6', accent: 'var(--purple)' },
  bank_officer: { label: 'Bank Portal', color: '#10b981', accent: 'var(--green)' }
};

// SVG Icons
function GridIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}
function SendIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 8h10M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 8A6 6 0 1 1 2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function ClockIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ShieldIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2L3 4.5v3.8C3 11.1 5.2 13.5 8 14c2.8-.5 5-2.9 5-5.7V4.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5.5 8l1.8 1.8 3.2-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ActivityIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1 8h2l2-5 3 10 2-7 2 5 2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function UsersIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1 13c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M11 4a2 2 0 0 1 0 4M15 13c0-1.8-1.6-3.2-3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function NetworkIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="3" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="13" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="3" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="13" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6.5 7L4.5 5.5M9.5 7l2-1.5M6.5 9l-2 1.5M9.5 9l2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}
function BellIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2a5 5 0 0 1 5 5v2l1 2H2l1-2V7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}
function LogoutIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10.5 11L14 8l-3.5-3M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = navConfigs[user?.role] || [];
  const meta = portalMeta[user?.role] || portalMeta.user;

  useEffect(() => {
    if (user?.role === 'user') {
      userAPI.getNotifications().then(d => {
        setNotifications(d.notifications || []);
        setUnread((d.notifications || []).filter(n => !n.read).length);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || user?.role !== 'user') return;
    socket.on('notification', (n) => {
      setNotifications(p => [{ ...n, createdAt: new Date(), read: false }, ...p]);
      setUnread(p => p + 1);
    });
    socket.on('account-blocked', (d) => {
      setNotifications(p => [{ message: d.message, type: 'blocked', createdAt: new Date(), read: false }, ...p]);
      setUnread(p => p + 1);
    });
    return () => { socket.off('notification'); socket.off('account-blocked'); };
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const markRead = () => {
    if (user?.role === 'user') userAPI.markRead().catch(() => {});
    setUnread(0);
    setNotifications(p => p.map(n => ({ ...n, read: true })));
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SV';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40, display: 'none' }} className="mobile-overlay" />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '228px',
        flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            {/* Vault icon */}
            <div style={{
              width: '32px', height: '32px',
              background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
              border: `1px solid ${meta.color}33`,
              borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="4" width="12" height="9" rx="2" stroke={meta.color} strokeWidth="1.3"/>
                <path d="M5 4V3a3 3 0 0 1 6 0v1" stroke={meta.color} strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="8" cy="8.5" r="1.5" stroke={meta.color} strokeWidth="1.2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '0.02em' }}>SecureVault</div>
              <div style={{ fontSize: '10px', color: meta.accent, fontFamily: 'var(--mono)', fontWeight: '500', marginTop: '-1px' }}>{meta.label}</div>
            </div>
          </div>

          {/* Trust badge */}
          <div className="trust-badge" style={{ fontSize: '10px' }}>
            <span className="dot dot-green" style={{ width: '5px', height: '5px' }} />
            End-to-end encrypted
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '10px 10px', flex: 1 }}>
          {nav.map(({ path, label, icon: Icon }) => {
            const exact = path === '/gateway' || path === '/bank' || path === '/dashboard';
            const active = exact ? location.pathname === path : location.pathname.startsWith(path);
            return (
              <Link key={path} to={path} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 10px',
                borderRadius: '9px',
                marginBottom: '2px',
                color: active ? 'var(--text)' : 'var(--text-3)',
                background: active ? 'var(--bg-hover)' : 'transparent',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: active ? '500' : '400',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}>
                {active && (
                  <span style={{
                    position: 'absolute',
                    left: 0, top: '25%', bottom: '25%',
                    width: '2px',
                    background: meta.accent,
                    borderRadius: '0 2px 2px 0',
                  }} />
                )}
                <span style={{ color: active ? meta.accent : 'currentColor', transition: 'color 0.15s', flexShrink: 0 }}>
                  <Icon size={14} />
                </span>
                {label}
              </Link>
            );
          })}

          {/* Separator */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '12px 2px' }} />

          {/* Security status */}
          <div style={{ padding: '8px 10px', background: 'rgba(16,185,129,0.06)', borderRadius: '9px', border: '1px solid rgba(16,185,129,0.1)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>System Status</div>
            {['Gateway', 'Encryption', 'ML Engine'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>
                <span className="dot dot-green pulse" style={{ width: '5px', height: '5px' }} />
                {item}
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>OK</span>
              </div>
            ))}
          </div>
        </nav>

        {/* User info */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          {user?.role === 'user' && (
            <div style={{
              marginBottom: '10px',
              padding: '10px 12px',
              background: 'var(--bg-3)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Balance</div>
              <div style={{ fontSize: '17px', fontWeight: '700', fontFamily: 'var(--mono)', color: 'var(--green)', letterSpacing: '-0.5px' }}>
                ₹{(user.balance || 0).toLocaleString()}
              </div>
            </div>
          )}

          {/* User avatar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}55)`,
              border: `1px solid ${meta.color}33`,
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '700', color: meta.accent,
              fontFamily: 'var(--font-display)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{user?.email}</div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', fontSize: '12px', padding: '7px', gap: '7px' }}>
            <LogoutIcon size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: '52px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          {/* Left: breadcrumb */}
          <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            {nav.find(n => {
              const exact = n.path === '/gateway' || n.path === '/bank' || n.path === '/dashboard';
              return exact ? location.pathname === n.path : location.pathname.startsWith(n.path);
            })?.label || 'SecureVault'}
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Live indicator */}
            {(user?.role === 'gateway_admin' || user?.role === 'bank_officer') && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', color: 'var(--green)',
                fontFamily: 'var(--mono)',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.15)',
                padding: '4px 10px', borderRadius: '20px',
              }}>
                <span className="dot dot-green pulse" style={{ width: '5px', height: '5px' }} />
                LIVE
              </div>
            )}

            {/* Notifications */}
            {user?.role === 'user' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowNotif(p => !p); if (unread > 0) markRead(); }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '9px',
                    color: 'var(--text-2)',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                >
                  <BellIcon size={14} />
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: '-5px', right: '-5px',
                      background: 'var(--red)', color: '#fff',
                      borderRadius: '50%', width: '16px', height: '16px',
                      fontSize: '9px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--bg-2)',
                    }}>{unread}</span>
                  )}
                </button>

                {showNotif && (
                  <div className="scale-pop" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: '300px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>Notifications</span>
                      {unread > 0 && <span className="badge badge-red" style={{ fontSize: '10px' }}>{unread} new</span>}
                    </div>
                    <div style={{ maxHeight: '320px', overflow: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                          <div style={{ marginBottom: '6px', fontSize: '20px' }}>🔔</div>
                          No alerts
                        </div>
                      ) : notifications.map((n, i) => (
                        <div key={i} style={{
                          padding: '11px 16px',
                          borderBottom: '1px solid var(--border)',
                          background: n.read ? 'transparent' : 'var(--blue-dim)',
                          transition: 'background 0.15s',
                        }}>
                          <div style={{
                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                          }}>
                            <span style={{ marginTop: '1px', flexShrink: 0 }}>
                              <span className="dot" style={{ background: n.type === 'blocked' ? 'var(--red)' : 'var(--blue)', width: '6px', height: '6px', borderRadius: '50%', display: 'block' }} />
                            </span>
                            <div>
                              <div style={{ fontSize: '12px', color: n.type === 'blocked' ? 'var(--red)' : 'var(--text-2)', lineHeight: 1.4 }}>{n.message}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px', fontFamily: 'var(--mono)' }}>{new Date(n.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 24px', overflow: 'auto' }} className="fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
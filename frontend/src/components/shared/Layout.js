import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

const navConfigs = {
  user: [
    { path: '/dashboard', label: 'Overview' },
    { path: '/payments', label: 'Payments' },
    { path: '/history', label: 'History' },
  ],
  gateway_admin: [
    { path: '/gateway', label: 'Overview' },
    { path: '/gateway/transactions', label: 'Live Transactions' },
    { path: '/gateway/users', label: 'Users' },
  ],
  bank_officer: [
    { path: '/bank', label: 'Overview' },
    { path: '/bank/fraud-alerts', label: 'Fraud Alerts' },
    { path: '/bank/transactions', label: 'Transactions' },
    { path: '/bank/network-graph', label: 'Network Graph' },
  ]
};

const portalMeta = {
  user: { label: 'User Portal', color: 'var(--blue)' },
  gateway_admin: { label: 'API Vault', color: 'var(--purple)' },
  bank_officer: { label: 'Bank Portal', color: 'var(--green)' }
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unread, setUnread] = useState(0);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, background: 'var(--bg-2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'var(--mono)', color: meta.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>SecureVault</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{meta.label}</div>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {nav.map(({ path, label }) => {
            const active = location.pathname === path || (path !== '/gateway' && path !== '/bank' && path !== '/dashboard' && location.pathname.startsWith(path));
            return (
              <Link key={path} to={path} style={{
                display: 'block', padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                color: active ? meta.color : 'var(--text-3)',
                background: active ? `${meta.color}15` : 'transparent',
                textDecoration: 'none', fontSize: '13px', fontWeight: active ? '500' : '400',
                transition: 'all 0.1s', borderLeft: active ? `2px solid ${meta.color}` : '2px solid transparent',
              }}>{label}</Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          {user?.role === 'user' && (
            <div style={{ marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-3)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>BALANCE</div>
              <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'var(--mono)', color: 'var(--green)' }}>Rs.{(user.balance || 0).toLocaleString()}</div>
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-2)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', fontSize: '12px', padding: '7px' }}>Sign Out</button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: '52px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', gap: '12px', flexShrink: 0 }}>
          {/* Live indicator for admins */}
          {(user?.role === 'gateway_admin' || user?.role === 'bank_officer') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
              <span className="dot dot-green pulse" />LIVE
            </div>
          )}

          {/* Notifications for users */}
          {user?.role === 'user' && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotif(p => !p); if (unread > 0) markRead(); }}
                className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '12px', position: 'relative' }}>
                Alerts
                {unread > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--red)', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{unread}</span>}
              </button>
              {showNotif && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '6px', width: '300px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', zIndex: 100, maxHeight: '360px', overflow: 'auto' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>Notifications</div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>No alerts</div>
                  ) : notifications.map((n, i) => (
                    <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--blue-dim)' }}>
                      <div style={{ fontSize: '12px', color: n.type === 'blocked' ? 'var(--red)' : 'var(--text-2)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px', fontFamily: 'var(--mono)' }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
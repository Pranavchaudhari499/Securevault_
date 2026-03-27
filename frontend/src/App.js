import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import UserDashboard from './pages/user/Dashboard';
import UserPayments from './pages/user/Payments';
import UserHistory from './pages/user/History';
import UserIntegrityTransactions from './pages/user/IntegrityTransactions';

import GatewayDashboard from './pages/gateway/Dashboard';
import GatewayUsers from './pages/gateway/Users';
import GatewayTransactions from './pages/gateway/Transactions';
import GatewayIntegrityTransactions from './pages/gateway/IntegrityTransactions';
import GatewayPolicySimulator from './pages/gateway/PolicySimulator';

import BankDashboard from './pages/bank/Dashboard';
import BankFraudAlerts from './pages/bank/FraudAlerts';
import BankTransactions from './pages/bank/Transactions';
import BankNetworkGraph from './pages/bank/NetworkGraph';
import BankIntegrityConsole from './pages/bank/IntegrityConsole';
import BankIntegrityTransactions from './pages/bank/IntegrityTransactions';
import BankPrecisionFirstMode from './pages/bank/PrecisionFirstMode';

function getDefaultRoute(role) {
  if (role === 'gateway_admin') return '/gateway';
  if (role === 'bank_officer') return '/bank';
  return '/dashboard';
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--blue)', fontFamily: 'monospace', fontSize: '14px' }}>
      Initializing SecureVault...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={getDefaultRoute(user.role)} replace />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getDefaultRoute(user.role)} />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to={getDefaultRoute(user.role)} />} />

      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['user']}><UserDashboard /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute allowedRoles={['user']}><UserPayments /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute allowedRoles={['user']}><UserHistory /></ProtectedRoute>} />
      <Route path="/integrity-transactions" element={<ProtectedRoute allowedRoles={['user']}><UserIntegrityTransactions /></ProtectedRoute>} />

      <Route path="/gateway" element={<ProtectedRoute allowedRoles={['gateway_admin']}><GatewayDashboard /></ProtectedRoute>} />
      <Route path="/gateway/users" element={<ProtectedRoute allowedRoles={['gateway_admin']}><GatewayUsers /></ProtectedRoute>} />
      <Route path="/gateway/transactions" element={<ProtectedRoute allowedRoles={['gateway_admin']}><GatewayTransactions /></ProtectedRoute>} />
      <Route path="/gateway/integrity-transactions" element={<ProtectedRoute allowedRoles={['gateway_admin']}><GatewayIntegrityTransactions /></ProtectedRoute>} />
      <Route path="/gateway/policy-simulator" element={<ProtectedRoute allowedRoles={['gateway_admin']}><GatewayPolicySimulator /></ProtectedRoute>} />

      <Route path="/bank" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankDashboard /></ProtectedRoute>} />
      <Route path="/bank/fraud-alerts" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankFraudAlerts /></ProtectedRoute>} />
      <Route path="/bank/transactions" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankTransactions /></ProtectedRoute>} />
      <Route path="/bank/network-graph" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankNetworkGraph /></ProtectedRoute>} />
      <Route path="/bank/integrity-console" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankIntegrityConsole /></ProtectedRoute>} />
      <Route path="/bank/integrity-transactions" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankIntegrityTransactions /></ProtectedRoute>} />
      <Route path="/bank/precision-first" element={<ProtectedRoute allowedRoles={['bank_officer']}><BankPrecisionFirstMode /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to={user ? getDefaultRoute(user.role) : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
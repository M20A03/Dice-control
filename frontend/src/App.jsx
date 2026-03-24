import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import AuthPage from './pages/AuthPage';
import TelegramVerifyPage from './pages/TelegramVerifyPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem' }}>🎲</div>
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Loading...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/admin" replace /> : <AuthPage />} />
        <Route path="/verify-telegram" element={<ProtectedRoute><TelegramVerifyPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              color: '#e8e8f0',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#1a1a2e' } },
            error: { iconTheme: { primary: '#ff6b6b', secondary: '#1a1a2e' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

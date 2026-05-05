import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from "./context/AuthContext";
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadCenter from './pages/UploadCenter';
import SearchPage from './pages/Search';
import CustomerProfile from './pages/CustomerProfile';
import { CustomersPage, DuplicatesPage, FilesPage, ExportsPage, UsersPage, AccountPage } from './pages/OtherPages';

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
      <Route path="/upload" element={<PrivateRoute roles={['admin', 'operator', 'viewer']}><AppLayout><UploadCenter /></AppLayout></PrivateRoute>} />
      <Route path="/search" element={<PrivateRoute><AppLayout><SearchPage /></AppLayout></PrivateRoute>} />
      <Route path="/customers" element={<PrivateRoute><AppLayout><CustomersPage /></AppLayout></PrivateRoute>} />
      <Route path="/customers/:id" element={<PrivateRoute><AppLayout><CustomerProfile /></AppLayout></PrivateRoute>} />
      <Route path="/duplicates" element={<PrivateRoute><AppLayout><DuplicatesPage /></AppLayout></PrivateRoute>} />
      <Route path="/files" element={<PrivateRoute><AppLayout><FilesPage /></AppLayout></PrivateRoute>} />
      <Route path="/exports" element={<PrivateRoute><AppLayout><ExportsPage /></AppLayout></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['admin']}><AppLayout><UsersPage /></AppLayout></PrivateRoute>} />
      <Route path="/account" element={<PrivateRoute><AppLayout><AccountPage /></AppLayout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border2)' },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg2)' } },
          error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg2)' } },
        }} />
      </BrowserRouter>
    </AuthProvider>
  );
}

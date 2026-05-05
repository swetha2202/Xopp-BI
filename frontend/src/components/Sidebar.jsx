import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, Search, Users, FileText, Download, Settings, LogOut, Menu, X, UserCircle } from 'lucide-react';
import { useAuth } from "../context/AuthContext";
import logo from '../assets/logo.png';

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'operator', 'viewer'] },
  { label: 'Upload Files', icon: Upload, path: '/upload', roles: ['admin', 'operator', 'viewer'] },
  { label: 'BI Search', icon: Search, path: '/search', roles: ['admin', 'operator', 'viewer'] },
  { label: 'Customers', icon: Users, path: '/customers', roles: ['admin', 'operator', 'viewer'] },
  { label: 'Source Files', icon: FileText, path: '/files', roles: ['admin', 'operator', 'viewer'] },
  { label: 'Exports', icon: Download, path: '/exports', roles: ['admin', 'operator', 'viewer'] },
  { label: 'Users', icon: Settings, path: '/users', roles: ['admin'] },
  { label: 'My Account', icon: UserCircle, path: '/account', roles: ['admin', 'operator', 'viewer'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = nav.filter(n => n.roles.includes(user?.role));
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo" style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logo} alt="Xopp BI Logo" style={{ height: '40px' }} />
          <div>
            <div style={{ fontWeight: '600', fontSize: '18px' }}>Xopp BI</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Xtreme Opportunities</div>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => handleNav(item.path)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="logout-btn" onClick={logout} title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logo} alt="Xopp BI Logo" style={{ height: '28px' }} />
          <span style={{ fontWeight: '600', fontSize: '16px' }}>Xopp BI</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <SidebarContent />
      </aside>
    </>
  );
}

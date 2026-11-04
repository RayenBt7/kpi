import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import '../styles/AdminDashboard.css';

// Import sub-components
import UsersManagement from './UsersManagement';
import PermissionsManagement from './PermissionsManagement';
import UsersProcessus from './UsersProcessus';
import SystemSettings from './SystemSettings';
import ThreeD from './threeD';

const AdminDashboard = ({ theme = 'dark' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isDark = theme === 'dark';
  const location = useLocation();

  const handleCloseAlert = () => {
    setError('');
    setSuccess('');
  };

  const menuItems = [
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: '👥',
      path: '/admin/users',
      short: 'Users',
    },
    {
      id: 'permissions',
      label: 'Permissions & Rôles',
      icon: '🛡️',
      path: '/admin/permissions',
      short: 'Perms',
    },
    {
      id: 'process-map',
      label: 'Processus & Users',
      icon: '🗂️',
      path: '/admin/process-map',
      short: 'Matrix',
    },
    {
      id: 'settings',
      label: 'Paramètres Système',
      icon: '⚙️',
      path: '/admin/settings',
      short: 'Config',
    },
    {/*{
      id: '3d',
      label: '3D Dashboard',
      icon: '🎲',
      path: '/threeD',
      short: '3D',
    },*/}
  ];

  const activeItem =
    menuItems.find((item) => location.pathname.includes(item.id)) || menuItems[0];

  return (
    <div className={`admin-layout ${isDark ? 'theme-dark' : 'theme-light'}`}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="logo-wrapper">
            <span className="logo-emoji">🛠️</span>
            {sidebarOpen && <h1 className="logo-text">Admin</h1>}
          </div>

          <button
            className="collapse-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Réduire la barre latérale' : 'Étendre la barre latérale'}
          >
            {sidebarOpen ? '«' : '»'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.id);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-shortcut">{item.short}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-pill">Online • v2.1.4</div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className={`main-area ${sidebarOpen ? 'sidebar-visible' : ''}`}>
        {/* Header */}
        <header className="topbar">
          <div className="topbar-left">
            <h2 className="page-title">{activeItem.label}</h2>
            <p className="page-subtitle">{activeItem.short}</p>
          </div>

          <div className="topbar-actions">
            <button className="btn btn-ghost">Rafraîchir</button>
            <button className="btn btn-primary">Exporter</button>
          </div>
        </header>

        {/* Alerts */}
        <div className="alerts-container">
          {error && (
            <div className="alert alert-danger fade-in">
              <span>{error}</span>
              <button className="alert-close" onClick={handleCloseAlert}>
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="alert alert-success fade-in">
              <span>{success}</span>
              <button className="alert-close" onClick={handleCloseAlert}>
                ×
              </button>
            </div>
          )}
        </div>

        {/* Page Content */}
        <main className="content-wrapper">
          <Routes>
            <Route path="/users" element={<UsersManagement theme={theme} />} />
            <Route path="/permissions" element={<PermissionsManagement theme={theme} />} />
            <Route path="/process-map" element={<UsersProcessus theme={theme} />} />
            <Route path="/settings" element={<SystemSettings theme={theme} />} />
            <Route path="*" element={<UsersManagement theme={theme} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

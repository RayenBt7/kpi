/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo,useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaBell, FaUserCircle, FaKey, FaEnvelope, FaExclamationTriangle, FaCheck, FaTimes, FaEdit, FaSave, FaExclamationCircle, FaBullseye, FaPlus, FaPaperPlane, FaClipboardList, FaCalendarAlt} from 'react-icons/fa';
import api from '../services/api';
import '../styles/Profile.css';

// ── Sidebar Component ─────────────────────────────────────────────────────────
function Sidebar({ menuItems, activeItem, onItemClick }) {
  return (
    <div className='side-bar'>
      <button className='close-sidebar'>X</button>
      
      <h1> <FaUserCircle />   Profile User</h1>
      <div className="side-bar-content">
        {menuItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${activeItem.id === item.id ? 'active' : ''}`}
            onClick={() => onItemClick(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Account Information ─────────────────────────────────────────────────────
function AccountInfo({ user }) {
  return (
    <div className="info-section">
      <h3>Account Information</h3>
      <div className="info-grid">
        <div className="info-item">
          <label>User ID</label>
          <span>{user.id}</span>
        </div>
        <div className="info-item">
          <label>Username</label>
          <span>{user.username}</span>
        </div>
        <div className="info-item">
          <label>Role</label>
          <span className={`role-badge ${user.isAdmin ? 'role-admin' : user.user_type === 'responsable' || user.user_type === 'pilote' ? 'role-admin' : 'role-user'}`}>
            {user.isAdmin ? 'Administrator' : user.user_type === 'responsable' ? 'Responsable' : user.user_type === 'pilote' ? 'Pilote' : 'User'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Indicator Tasks ─────────────────────────────────────────────────────────
function IndicatorTasks({ tasks, onNavigate }) {
  const [editableInfo, setEditableInfo] = useState({ isAdmin: true, user_type: 'user', indicators: [] });
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [periodicityMenuOpen, setPeriodicityMenuOpen] = useState(false);
  const [actionExistsMap, setActionExistsMap] = useState({}); // To trigger re-render after action plan navigation
  
  const MONTHS = [
    { key: 'all', label: 'Tous les mois' },
    { key: 'janv', label: 'Janvier' },
    { key: 'fev', label: 'Février' },
    { key: 'mars', label: 'Mars' },
    { key: 'avril', label: 'Avril' },
    { key: 'mai', label: 'Mai' },
    { key: 'juin', label: 'Juin' },
    { key: 'juil', label: 'Juillet' },
    { key: 'aout', label: 'Août' },
    { key: 'sept', label: 'Septembre' },
    { key: 'oct', label: 'Octobre' },
    { key: 'nov', label: 'Novembre' },
    { key: 'decem', label: 'Décembre' },
  ];


  // Fonction pour vérifier l'existence d'un plan d'action
  const checkActionPlanExistence = useCallback(async (indicateur,year)=>{
    try {
      const response = await api.get(`/api/actions/exists/${encodeURIComponent(indicateur)}?year=${year}`);
      return response.data.exists || false ;  
    }catch (error) {
      console.error('Error checking action plan existence:', error);
      return false;
    }
  },[]);
  useEffect(() => {
    const loadActionPlanExistence = async () => {
      const currentYear = new Date().getFullYear();
      const existenceMap = {};
      for (const task of tasks) {
        if (task.Indicateur) {
          try {
            const exists = await checkActionPlanExistence(task.Indicateur,currentYear);
            existenceMap[task.Indicateur] = exists;
          } catch (e) {
            existenceMap[task.Indicateur] = false;
          }
        }
      }
      setActionExistsMap(existenceMap);
    };
    if (tasks.length > 0) {
      loadActionPlanExistence();
    }
  }, [tasks, checkActionPlanExistence]);
    
  // Get month status for display - MODIFIÉ
  const getMonthStatus = (task) => {
    if (selectedMonth === 'all') {
      return {
        status: task.notificationStatus,
        hasActionPlan: actionExistsMap[task.Indicateur] || false
      };
    }
    const monthData = task.monthlyStatus?.[selectedMonth];
    if (!monthData) {
      return { status: 'pas_donnee', hasActionPlan: false };
    }
    
    return {
      status: monthData.status,
      hasActionPlan: actionExistsMap[task.Indicateur] || false
    };
  };
  
  // Removed notification button functionality
  
  const groupedTasks = useMemo(() => {
    return tasks.reduce((acc, task) => {
      // Get status based on selected month - inline logic to avoid dependency issue
      let status;
      if (selectedMonth === 'all') {
        status = task.notificationStatus || 'ok';
      } else {
        const monthData = task.monthlyStatus?.[selectedMonth];
        if (!monthData) {
          status = 'pas_donnee';
        } else {
          status = monthData.status;
        }
      }
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {});
  }, [tasks, selectedMonth]);
  useEffect(() => {
    const loadEditableInfo = async () => {
      try {
        const response = await api.get('/api/indicateurs/user-tasks');
        setEditableInfo({
          isAdmin: !!response.data.isAdmin,
          user_type: response.data.user_type || 'user',
          indicators: response.data.indicateurs || []
        });
      } catch (error) {
        setEditableInfo({ isAdmin: false, user_type: 'user', indicators: [] });
      }
    };

    loadEditableInfo();
  }, []);



  const isResponsable = editableInfo.user_type === 'responsable';
  const isPilote = editableInfo.user_type === 'pilote' || editableInfo.isAdmin;

  return (
    
    <div className="info-section indicator-tasks-section">

      {editableInfo.isAdmin && <h3>User Indicator Tasks</h3>}
      <h3>Indicator Tasks</h3>
      
      {/* Month Selector - Button Style */}
      <div 
        className="profile-periodicity-control"
        onMouseEnter={() => setPeriodicityMenuOpen(true)}
        onMouseLeave={() => setPeriodicityMenuOpen(false)}
      >
        <button
          type="button"
          className="profile-periodicity-btn"
          aria-haspopup="listbox"
          aria-expanded={periodicityMenuOpen}
        >
          <span className="profile-periodicity-label">Période:</span>
          <span className="profile-periodicity-value">
            {MONTHS.find(m => m.key === selectedMonth)?.label || 'Tous les mois'}
          </span>
          <span className="profile-periodicity-caret">▼</span>
        </button>
        <div className={`profile-periodicity-menu ${periodicityMenuOpen ? 'open' : ''}`}>
          {MONTHS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`profile-periodicity-option ${selectedMonth === m.key ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMonth(m.key);
                setPeriodicityMenuOpen(false);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="no-tasks">No indicator tasks assigned.</p>
      ) : (
        Object.entries(groupedTasks).map(([status, group]) => (
          <div key={status} className="task-group">
            <h4>Status: {status}</h4>
            <div className="indicator-tasks-table-wrap">
              <table className="indicator-tasks-table">
              <thead>
                <tr>
                  <th>Processus</th>
                  <th>Designation</th>
                  {(isResponsable || isPilote) && <th>{isResponsable ? 'Utilisateur' : 'Escalade'}</th>}
                  <th>Notification</th>
                  <th>Date Limite</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {group.map(task => (
                  <tr key={task.Indicateur}>
                    <td>{task.processus || '-'}</td>
                    <td>{task.Designation || task.Indicateur || '-'}</td>
                    {(isResponsable || isPilote) && <td>{isResponsable ? (task.utilisateur || '-') : (task.escalade || '-')}</td>}
                    <td>
                      {/* Get month-based status */}
                      {(() => {
                        const monthStatus = getMonthStatus(task);
                        return (
                          <>
                            {/* Valeur saisie mais non atteint - Afficher badge */}
                            {monthStatus.status === 'non_atteint' && (
                              <span className="notification-badge pending" title="Objectif non atteint - Cliquer pour voir le plan d'action">
                                <FaExclamationTriangle /> Non atteint
                              </span>
                            )}
                            
                            {/* Valeur non saisie */}
                            {monthStatus.status === 'non_saisie' && (
                              <span className="notification-badge warning" title="Valeur non saisie - Notification email uniquement">
                                <FaExclamationCircle /> Valeur non saisie
                              </span>
                            )}
                            
                            {/* Pas de données pour ce mois */}
                            {monthStatus.status === 'pas_donnee' && (
                              <span className="notification-badge" style={{ background: '#9ca3af', color: '#fff' }}>
                                Pas de données
                              </span>
                            )}
                            
                            {/* Objectif atteint */}
                            {monthStatus.status === 'ok' && (
                              <span className="notification-badge ok"><FaCheck /> OK</span>
                            )}
                          </>
                        );
                      })()}
                      
                      {/* Date limite dépassée */}
                      {task.earliest_deadline && new Date(task.earliest_deadline) < new Date() && (
                        <span className="notification-badge deadline-passed" style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 12 }}>
                          <FaCalendarAlt /> Date limite dépassée
                        </span>
                      )}
                      
                      {/* Objectif défini (deadline future) */}
                      {task.hasDeadline && task.earliest_deadline && new Date(task.earliest_deadline) >= new Date() && (
                        <span className="notification-badge deadline" style={{ marginLeft: 6, background: '#0ea5e9', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 12 }}>
                          <FaBullseye /> Objectif défini
                        </span>
                      )}
                    </td>
                    <td>
                      {task.hasDeadline && task.earliest_deadline ? (
                        <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                          {new Date(task.earliest_deadline).toLocaleDateString('fr-FR')}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>

                    <td>
                      {(() => {
                        const monthStatus = getMonthStatus(task);
                        // Afficher le bouton SEULEMENT si non_atteint ET pas de plan existant
                        if (monthStatus.status === 'non_atteint' && !monthStatus.hasActionPlan) {
                          return (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onNavigate(task.Indicateur, 'plan_action', selectedMonth)}
                            >
                              Plan Action
                            </button>
                          );
                        } else if (monthStatus.hasActionPlan) {
                          return <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: '500' }}>✓ Plan créé</span>;
                        }
                        return null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Email Section ───────────────────────────────────────────────────────────
function EmailSection({ userEmail, setUserEmail, handleSave, editingEmail, setEditingEmail, savingEmail }) {
  return (
    <div className="info-section email-section">
      <h3>Email Address
        <span className="email-purpose-hint">Used for password recovery</span>
      </h3>

      {!editingEmail ? (
        <div className="email-display-row">
          <div className="email-display">
            {userEmail ? (
              <>
                <span className="email-icon"><FaEnvelope /></span>
                <span className="info-value">{userEmail}</span>
                <span className="email-verified-badge">Défini</span>
              </>
            ) : (
              <>
                <span className="email-icon"><FaExclamationCircle /></span>
                <span className="email-not-set">
                  Aucun email défini — vous ne pourrez pas réinitialiser votre mot de passe.
                </span>
              </>
            )}
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setEditingEmail(true)}
          >
            {userEmail ? <><FaEdit /> Modifier</> : <><FaPlus /> Ajouter</>}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="email-form">
          <div className="email-input-row">
            <input
              type="email"
              className="profile-input email-input"
              placeholder="votre@email.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="btn btn-success btn-sm" disabled={savingEmail}>
              {savingEmail ? 'Saving…' : <><FaSave /> Save</>}
            </button>
            <button type="button" className="btn btn-secondary btn-sm"
              onClick={() => setEditingEmail(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Password Section ────────────────────────────────────────────────────────
function PasswordSection({ navigate }) {
  return (
    <div className="info-section">
      <h3>Mot de passe</h3>
      <div className="email-display-row">
        <div className="email-display">
          <span className="email-icon"><FaLock /></span>
          <span className="info-value" style={{ opacity: 0.7 }}>
            Pour changer votre mot de passe, utilisez la fonctionnalité "Mot de passe oublié".
          </span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate('/forgot-password')}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ── Admin Section ─────────────────────────────────────────────────────────
function AdminSection({ navigate }) {
  return (
    <div className="admin-section">
      <h3>Admin Features</h3>
      <p className="admin-note">
        You have administrator privileges. You can manage users and system settings.
      </p>
      <div className="admin-actions">
        <button className="btn btn-warning" onClick={() => navigate('/admin')}>
          Go to Admin Panel
        </button>
      </div>
    </div>
  );
}

// ── Notifications Section ─────────────────────────────────────────────────────────
function NotificationsSection({ userRole, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, non_lue, traitee
  
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      loadNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`);
      loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'rappel': 'Rappel',
      'non_saisie': 'Valeur non saisie',
      'objectif_non_atteint': 'Objectif non atteint',
      'delai_depasse': 'Délai dépassé',
      'avertissement': 'Avertissement'
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'rappel': return '🔔';
      case 'non_saisie': return '⚠️';
      case 'objectif_non_atteint': return '❌';
      case 'delai_depasse': return '⏰';
      case 'avertissement': return '📢';
      default: return '📋';
    }
  };

  const getPriorityClass = (priorite) => {
    switch (priorite) {
      case 'critique': return 'priority-critique';
      case 'haute': return 'priority-haute';
      case 'normale': return 'priority-normale';
      default: return 'priority-normale';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'non_lue') return n.statut === 'non_lue';
    if (filter === 'traitee') return n.statut === 'traitee' || n.statut === 'lue';
    return true;
  });

  if (loading) {
    return <div className="info-section notifications-section"><p>Chargement des notifications...</p></div>;
  }

  return (
    <div className="info-section notifications-section">
      <div className="notifications-header">
        <h3>
          <FaBell /> Notifications 
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </h3>
        {unreadCount > 0 && (
          <button className="btn btn-sm btn-outline" onClick={handleMarkAllAsRead}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="notifications-filter">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Toutes
        </button>
        <button 
          className={`filter-btn ${filter === 'non_lue' ? 'active' : ''}`}
          onClick={() => setFilter('non_lue')}
        >
          Non lues {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button 
          className={`filter-btn ${filter === 'traitee' ? 'active' : ''}`}
          onClick={() => setFilter('traitee')}
        >
          Traitées
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <p className="no-notifications">Aucune notification</p>
      ) : (
        <div className="notifications-list">
          {filteredNotifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${notif.statut} ${getPriorityClass(notif.priorite)}`}
              onClick={() => notif.statut === 'non_lue' && handleMarkAsRead(notif.id)}
            >
              <div className="notification-icon">{getTypeIcon(notif.type)}</div>
              <div className="notification-content">
                <div className="notification-type">{getTypeLabel(notif.type)}</div>
                <div className="notification-message">{notif.message}</div>
                <div className="notification-meta">
                  {notif.indicateur && <span className="notif-indicateur">{notif.indicateur}</span>}
                  {notif.processus && <span className="notif-processus">{notif.processus}</span>}
                  <span className="notif-date">
                    {new Date(notif.date_creation).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              <div className="notification-actions">
                {notif.indicateur && (
                  <button 
                    className="btn-icon" 
                    onClick={(e) => { e.stopPropagation(); onNavigate(notif.indicateur); }}
                    title="Voir le plan d'action"
                  >
                    📋
                  </button>
                )}
                <button 
                  className="btn-icon" 
                  onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Profile Component ─────────────────────────────────────────────────
const Profile = ({ authUser, theme = 'dark' }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [indicatorTasks, setIndicatorTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');

  const [emailValue, setEmailValue] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const menuItems = [
    { id: 'profile', label: 'Mon Profil', icon: <FaUser /> },
    { id: 'account', label: 'Compte', icon: <FaKey /> },
    { id: 'notifications', label: 'Notifications', icon: <FaBell /> },
  ];

  const activeItem = menuItems.find(item => activeSection === item.id) || menuItems[0];
  const isDark = theme === 'dark';

  // ── Fetch Profile ─────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/auth/me');
        setUser(res.data.user);
        setEmailValue(res.data.user.email || '');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [authUser]);

  // ── Fetch Indicator Tasks (only for non-admin users) ────────────────────────
  useEffect(() => {
    if (!authUser || user?.isAdmin) return;
    const loadTasks = async () => {
      try {
        const res = await api.get('/api/indicateurs/user-tasks');
        setIndicatorTasks(res.data.indicateurs || []);
      } catch (err) {
        setIndicatorTasks([]);
      }
    };
    loadTasks();
  }, [authUser, user]);

  // ── Handle Save Email ─────────────────────────────────────────
  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!emailValue.trim()) return setError('Email cannot be empty.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue.trim())) return setError('Invalid email');

    try {
      setSavingEmail(true);
      await api.put('/api/auth/update-email', { email: emailValue.trim() });
      setSuccess(<><FaCheck /> Email updated successfully!</>);
      setEditingEmail(false);
      const res = await api.get('/api/auth/me');
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update email.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleCloseAlert = () => { setError(''); setSuccess(''); };

  if (loading) return <div className={`profile-page ${isDark ? 'theme-dark' : 'theme-light'}`}><p>Loading...</p></div>;

  return (
    <div className={`profile-page ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <Sidebar menuItems={menuItems} activeItem={activeItem} onItemClick={setActiveSection} />
      <div className="profile-container">
        {error && <div className="alert alert-error"><span>{error}</span><button onClick={handleCloseAlert}>×</button></div>}
        {success && <div className="alert alert-success"><span>{success}</span><button onClick={handleCloseAlert}>×</button></div>}

        {user && (
          <>
            {activeSection === 'profile' && (
              <>
                <AccountInfo user={user} />
                <PasswordSection navigate={navigate} />
              </>
            )}
            
            {activeSection === 'account' && (
              <EmailSection
                userEmail={emailValue}
                setUserEmail={setEmailValue}
                handleSave={handleSaveEmail}
                editingEmail={editingEmail}
                setEditingEmail={setEditingEmail}
                savingEmail={savingEmail}
              />
            )}
            
            {activeSection === 'notifications' && (
              <>
                {/* Section des tâches d'indicateurs */}
                {!user.isAdmin && <IndicatorTasks tasks={indicatorTasks} onNavigate={(ind, dest, month) => {
                  if (dest === 'plan_action') {
                    // Pass month if a specific month is selected (not 'all')
                    const monthParam = month !== 'all' ? `?month=${month}` : '';
                    navigate(`/plan-action/${ind}${monthParam}`);
                  } else {
                    navigate(`/kpi?highlight=${ind}`);
                  }
                }} />}
                {/* Nouvelle section des notifications */}
                <NotificationsSection 
                  userRole={user.user_type} 
                  onNavigate={(ind) => navigate(`/plan-action/${ind}`)}
                />
                {user.isAdmin && <AdminSection navigate={navigate} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;

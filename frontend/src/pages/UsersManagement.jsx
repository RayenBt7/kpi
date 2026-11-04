import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/UsersManagement.css';

const CURRENT_YEAR = new Date().getFullYear();
const USER_TYPES = ['user', 'responsable', 'pilote'];
const TYPE_LABELS = { user: 'User', responsable: 'Responsable', pilote: 'Pilote' };

const normalizeType = (val) =>
  USER_TYPES.includes(String(val ?? '').trim().toLowerCase()) ? val.trim().toLowerCase() : 'user';

const UsersManagement = ({ theme = 'dark' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ by: 'username', order: 'asc' });

  const [showCreate, setShowCreate] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  const [newUser, setNewUser] = useState({ username: '', password: '', type: 'user' });

  // ─── États pour le modal Responsables Plan d'Action ───
  const [processus, setProcessus] = useState([]);
  const [selectedProcessus, setSelectedProcessus] = useState('');
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [customDrafts, setCustomDrafts] = useState({});
  const [loadingRows, setLoadingRows] = useState(false);
  const [savingFor, setSavingFor] = useState('');

  const isDark = theme === 'dark';

  // Chargement utilisateurs
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/admin/users');
        setUsers((data.users || []).map(u => ({ ...u, userType: normalizeType(u.userType) })));
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur chargement' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Chargement liste des processus (quand modal ouvert)
  useEffect(() => {
    if (!showActionModal) return;
    (async () => {
      setLoadingRows(true);
      try {
        const { data } = await api.get('/api/dashboard/processus');
        const list = data.processus || [];
        setProcessus(list);
        setSelectedProcessus(prev => (prev && list.includes(prev) ? prev : list[0] || ''));
      } catch {
        setMessage({ type: 'error', text: 'Erreur chargement processus' });
        setProcessus([]);
      } finally {
        setLoadingRows(false);
      }
    })();
  }, [showActionModal]);

  // Chargement indicateurs pour le processus sélectionné
  useEffect(() => {
    if (!showActionModal || !selectedProcessus) return;
    (async () => {
      setLoadingRows(true);
      try {
        const { data } = await api.get(
          `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${CURRENT_YEAR}`
        );
        const incoming = data.rows || [];
        setRows(incoming);
        setDrafts(
          Object.fromEntries(
            incoming
              .map(r => [String(r.Indicateur ?? '').trim(), String(r.ActionResponsable ?? r.Responsable ?? '').trim()])
              .filter(([k]) => k)
          )
        );
      } catch {
        setMessage({ type: 'error', text: 'Erreur chargement indicateurs' });
        setRows([]);
        setDrafts({});
      } finally {
        setLoadingRows(false);
      }
    })();
  }, [showActionModal, selectedProcessus]);

  const saveResponsable = async (indicateur) => {
    const id = String(indicateur).trim();
    if (!id) return;

    // custom text input takes priority over the select
    const responsable = String(customDrafts[id] || drafts[id] || '').trim();
    setSavingFor(id);

    try {
      await api.put(`/api/dashboard/indicateur/${encodeURIComponent(id)}/action-responsable`, {
        responsable,
      });
      setRows(prev =>
        prev.map(r => (String(r.Indicateur ?? '').trim() === id ? { ...r, ActionResponsable: responsable } : r))
      );
      setMessage({ type: 'success', text: 'Responsable affecté' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Échec affectation' });
    } finally {
      setSavingFor('');
    }
  };

  // ─── CRUD Utilisateurs ────────────────────────────────────────
  const createUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setMessage({ type: 'error', text: 'Nom et mot de passe requis' });
      return;
    }

    try {
      const { data } = await api.post('/api/auth/register', {
        username: newUser.username.trim(),
        password: newUser.password,
      });

      const uid = data.user?.id;
      const type = normalizeType(newUser.type);
      if (uid && type !== 'user') {
        await api.put(`/api/admin/users/${uid}/type`, { userType: type });
      }

      setMessage({ type: 'success', text: 'Utilisateur créé' });
      setShowCreate(false);
      setNewUser({ username: '', password: '', type: 'user' });

      const res = await api.get('/api/admin/users');
      setUsers((res.data.users || []).map(u => ({ ...u, userType: normalizeType(u.userType) })));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Échec création' });
    }
  };

  const updateType = async (id, next) => {
    try {
      await api.put(`/api/admin/users/${id}/type`, { userType: normalizeType(next) });
      const { data } = await api.get('/api/admin/users');
      setUsers((data.users || []).map(u => ({ ...u, userType: normalizeType(u.userType) })));
      setMessage({ type: 'success', text: 'Type mis à jour' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Échec' });
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Supprimer ${username} ?`)) return;
    try {
      await api.delete(`/api/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      setMessage({ type: 'success', text: 'Supprimé' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Échec suppression' });
    }
  };

  // ─── Computed ─────────────────────────────────────────────────
  const filteredUsers = users
    .filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let A = a[sort.by];
      let B = b[sort.by];
      if (sort.by === 'userType') {
        A = normalizeType(A);
        B = normalizeType(B);
      }
      const cmp = String(A).localeCompare(String(B));
      return sort.order === 'asc' ? cmp : -cmp;
    });

  const toggleSort = (field) => {
    setSort(prev =>
      prev.by === field
        ? { ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { by: field, order: 'asc' }
    );
  };

  // ─── Rendu ────────────────────────────────────────────────────
  return (
    <div className={`users-management ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <div className="management-header">
        <div>
          <h2>Gestion Utilisateurs</h2>
          <p>Rôles : user / responsable / pilote</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-action-responsable" onClick={() => setShowActionModal(true)}>
            Resp. Plan d'Action <small>par indicateur</small>
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nouvel utilisateur
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      <div className="management-filters">
        <input
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <div>
          <select value={sort.by} onChange={e => toggleSort(e.target.value)} className="sort-select">
            <option value="username">Nom</option>
            <option value="id">ID</option>
            <option value="userType">Type</option>
          </select>
          <button className="btn btn-outline" onClick={() => toggleSort(sort.by)}>
            {sort.order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id')}>ID {sort.by === 'id' && (sort.order === 'asc' ? '↑' : '↓')}</th>
                <th onClick={() => toggleSort('username')}>Username {sort.by === 'username' && (sort.order === 'asc' ? '↑' : '↓')}</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Type</th>
                <th>Responsable (table)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="no-users">Aucun résultat</td></tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={`${user.id}-${user.username || index}`}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>
                      <span className={`role-badge role-${normalizeType(user.userType)}`}>
                        {TYPE_LABELS[normalizeType(user.userType)]}
                      </span>
                    </td>
                    <td><span className="status-active">{user.isAdmin ? 'Admin' : 'Actif'}</span></td>
                    <td>
                      <select
                        value={normalizeType(user.userType)}
                        onChange={e => updateType(user.id, e.target.value)}
                        className="user-type-select"
                      >
                        {USER_TYPES.map(t => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {user.responsable_name ? (
                        <span className="role-badge role-responsable">{user.responsable_name}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => deleteUser(user.id, user.username)}
                        disabled={user.isAdmin}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Création utilisateur ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content create-user-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="create-user-modal-header">
              <div className="create-user-modal-icon">👤</div>
              <div>
                <h3 className="create-user-modal-title">Nouvel utilisateur</h3>
                <p className="create-user-modal-sub">Créer un compte dans le système AAF KPI</p>
              </div>
              <button className="modal-close create-user-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={createUser} className="modal-form create-user-form">
              {/* Username */}
              <div className="cu-field">
                <label className="cu-label">Nom d'utilisateur</label>
                <input
                  placeholder="ex: jean.dupont"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  className="form-input cu-input"
                />
              </div>
              {/* Password */}
              <div className="cu-field">
                <label className="cu-label">Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  className="form-input cu-input"
                />
              </div>
              {/* Type */}
              <div className="cu-field">
                <label className="cu-label">Type de rôle</label>
                <div className="cu-type-pills">
                  {USER_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`cu-type-pill ${newUser.type === t ? 'active' : ''} cu-pill-${t}`}
                      onClick={() => setNewUser({ ...newUser, type: t })}
                    >
                      {t === 'user' ? '👤' : t === 'responsable' ? '🏅' : '✈️'} {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-actions create-user-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary create-user-submit">
                  ✓ Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Responsables Action ── */}
      {showActionModal && (
        <div
          className="modal-overlay action-responsable-modal-overlay"
          onClick={() => setShowActionModal(false)}
        >
          <div
            className="modal-content modal-content-wide action-responsable-modal arm-redesign"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="arm-header">
              <div className="arm-header-left">
                <span className="arm-icon">🏅</span>
                <div>
                  <h3 className="arm-title">Responsables Plan d'Action</h3>
                  <p className="arm-subtitle">Affectez le responsable d'action par indicateur</p>
                </div>
              </div>
              <div className="arm-header-right">
                <span className="arm-badge">{rows.length} indicateur{rows.length !== 1 ? 's' : ''}</span>
                <button className="modal-close arm-close" onClick={() => setShowActionModal(false)}>×</button>
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="arm-toolbar">
              <div className="arm-processus-field">
                <label className="arm-label">Processus</label>
                <select
                  value={selectedProcessus}
                  onChange={e => setSelectedProcessus(e.target.value)}
                  className="form-input arm-select"
                >
                  {processus.length === 0
                    ? <option>Aucun processus</option>
                    : processus.map(p => <option key={p} value={p}>{p}</option>)
                  }
                </select>
              </div>
              <div className="arm-info-chip">
                <span>ℹ️</span>
                <span>La valeur affectée est enregistrée dans la colonne <code>responsable_action</code> de la table <strong>responsable</strong>.</span>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="arm-body">
              {loadingRows ? (
                <div className="arm-loading">
                  <span className="arm-spinner" /> Chargement…
                </div>
              ) : rows.length === 0 ? (
                <div className="arm-empty">Aucun indicateur pour ce processus.</div>
              ) : (
                <div className="arm-list">
                  {rows.map(row => {
                    const id = String(row?.Indicateur ?? '').trim();
                    if (!id) return null;

                    const designation = String(row?.Designation ?? id).trim() || id;
                    const currentAction = String(row?.ActionResponsable ?? '').trim();
                    const source = String(row?.Responsable ?? '').trim();

                    // build options: all responsable-type users + source + current (deduplicated)
                    const allUserOptions = users
                      .filter(u => u.userType === 'responsable' || u.userType === 'pilote')
                      .map(u => u.username);
                    const options = [...new Set([...allUserOptions, source, currentAction].filter(Boolean))];

                    return (
                      <div key={id} className="arm-row">
                        <div className="arm-row-meta">
                          <span className="arm-row-code">{id}</span>
                          <strong className="arm-row-designation">{designation}</strong>
                          <div className="arm-row-status">
                            {currentAction ? (
                              <span className="arm-current-badge">
                                🏅 Action : <strong>{currentAction}</strong>
                              </span>
                            ) : source ? (
                              <span className="arm-source-badge">
                                👤 Source : {source}
                              </span>
                            ) : (
                              <span className="arm-none-badge">—</span>
                            )}
                          </div>
                        </div>

                        <div className="arm-row-controls">
                          <select
                            className="form-input arm-row-select"
                            value={drafts[id] ?? currentAction}
                            onChange={e => {
                              setDrafts(prev => ({ ...prev, [id]: e.target.value }));
                              setCustomDrafts(prev => ({ ...prev, [id]: '' }));
                            }}
                          >
                            <option value="">Choisir un responsable…</option>
                            {options.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <span className="arm-or">ou</span>
                          <input
                            type="text"
                            className="form-input arm-row-custom-input"
                            placeholder="Nouveau nom…"
                            value={customDrafts[id] ?? ''}
                            onChange={e => setCustomDrafts(prev => ({ ...prev, [id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-primary arm-save-btn"
                            disabled={!id || savingFor === id || (!drafts[id] && !customDrafts[id])}
                            onClick={async () => { await saveResponsable(id); setCustomDrafts(prev => ({ ...prev, [id]: '' })); }}
                          >
                            {savingFor === id ? (
                              <><span className="arm-btn-spinner" /> En cours…</>
                            ) : (
                              '+ Affecter'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="arm-footer">
              <button className="btn btn-outline arm-close-btn" onClick={() => setShowActionModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;

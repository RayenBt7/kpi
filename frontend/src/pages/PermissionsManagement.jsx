import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import '../styles/PermissionsManagement.css';

const PermissionsManagement = ({ theme = 'dark' }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]); // [{id, processus, indicateur}]
  const [allPermissions, setAllPermissions] = useState([]);   // all permissions in DB

  const [processusList, setProcessusList] = useState([]);
  const [indicateursList, setIndicateursList] = useState([]);
  const [selectedProcessus, setSelectedProcessus] = useState('');
  const [selectedIndicateurs, setSelectedIndicateurs] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [loadingProcessus, setLoadingProcessus] = useState(false);
  const [loadingIndicateurs, setLoadingIndicateurs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDark = theme === 'dark';

  // ── Fetch all users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError('');
      const res = await api.get('/api/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger les utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ── Fetch all permissions (full list with user info) ─────────────────────────
  const fetchAllPermissions = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/permissions');
      setAllPermissions(res.data.permissions || []);
    } catch (err) {
      console.error('Failed to load all permissions', err);
    }
  }, []);

  // ── Fetch processus list from Indicateur table ───────────────────────────────
  const fetchProcessus = useCallback(async () => {
    try {
      setLoadingProcessus(true);
      const res = await api.get('/api/dashboard/processus');
      setProcessusList(res.data.processus || []);
    } catch (err) {
      console.error('Failed to load processus', err);
    } finally {
      setLoadingProcessus(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAllPermissions();
    fetchProcessus();
  }, [fetchUsers, fetchAllPermissions, fetchProcessus]);

  // ── When processus changes, load its indicateurs ─────────────────────────────
  useEffect(() => {
    if (!selectedProcessus) {
      setIndicateursList([]);
      setSelectedIndicateurs([]);
      return;
    }

    const load = async () => {
      try {
        setLoadingIndicateurs(true);
        setSelectedIndicateurs([]);
        const res = await api.get(
          `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}`
        );
        const rows = res.data.rows || [];
        // Extract unique indicators with their Designation
        const indicateursMap = new Map();
        rows.forEach((r) => {
          const indicateur = (r.Indicateur || '').trim();
          const designation = (r.Designation || '').trim();
          if (indicateur) {
            // Use designation as display, indicateur as value
            if (!indicateursMap.has(indicateur)) {
              indicateursMap.set(indicateur, designation || indicateur);
            }
          }
        });
        // Sort by Designation
        const sortedIndicateurs = Array.from(indicateursMap.entries())
          .sort((a, b) => (a[1] || a[0]).localeCompare(b[1] || b[0]));
        setIndicateursList(sortedIndicateurs);
      } catch (err) {
        console.error('Failed to load indicateurs', err);
        setIndicateursList([]);
      } finally {
        setLoadingIndicateurs(false);
      }
    };

    load();
  }, [selectedProcessus]);

  // ── When user is selected, filter their permissions from allPermissions ───────
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setError('');
    setSuccess('');
    setSelectedProcessus('');
    setSelectedIndicateurs([]);
    loadUserPermissions(user.id);
  };

  const loadUserPermissions = async (userId) => {
    try {
      setLoadingPerms(true);
      // Re-fetch full list so we always have the IDs
      const res = await api.get('/api/admin/permissions');
      const all = res.data.permissions || [];
      setAllPermissions(all);
      setUserPermissions(all.filter((p) => p.user_id === userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger les permissions');
    } finally {
      setLoadingPerms(false);
    }
  };

  // ── Add permission ────────────────────────────────────────────────────────────
  const handleAddPermission = async () => {
    if (!selectedUser || !selectedProcessus || selectedIndicateurs.length === 0) {
      setError('Veuillez sélectionner un processus et au moins un indicateur.');
      return;
    }

    const selectedUnique = [...new Set(selectedIndicateurs.map((item) => String(item).trim()).filter(Boolean))];
    const alreadyAssigned = new Set(
      userPermissions
        .filter((p) => p.processus === selectedProcessus)
        .map((p) => String(p.indicateur || '').trim())
        .filter(Boolean)
    );
    const toCreate = selectedUnique.filter((ind) => !alreadyAssigned.has(ind));

    if (toCreate.length === 0) {
      setError('Toutes les permissions sélectionnées existent déjà pour cet utilisateur.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const results = await Promise.allSettled(
        toCreate.map((indicateur) =>
          api.post('/api/admin/permissions', {
            userId: selectedUser.id,
            processus: selectedProcessus,
            indicateur,
          })
        )
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failures = results.filter((result) => result.status === 'rejected');

      if (successCount > 0) {
        setSuccess(
          `${successCount} permission(s) ajoutée(s) pour ${selectedUser.username} sur "${selectedProcessus}".`
        );
      }

      if (failures.length > 0) {
        const firstFailureMessage =
          failures[0]?.reason?.response?.data?.error ||
          "Certaines permissions n'ont pas pu être ajoutées.";
        setError(`${firstFailureMessage} (${failures.length} échec(s))`);
      }

      setSelectedIndicateurs([]);
      await loadUserPermissions(selectedUser.id);
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'ajouter la permission");
    } finally {
      setSaving(false);
    }
  };

  // ── Remove permission ─────────────────────────────────────────────────────────
  const handleRemovePermission = async (permId) => {
    if (!window.confirm('Supprimer cette permission ?')) return;

    try {
      setRemovingId(permId);
      setError('');
      setSuccess('');
      await api.delete(`/api/admin/permissions/${permId}`);
      setSuccess('Permission supprimée.');
      await loadUserPermissions(selectedUser.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de supprimer la permission');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCloseAlert = () => {
    setError('');
    setSuccess('');
  };

  // ── Group user permissions by processus ───────────────────────────────────────
  const grouped = userPermissions.reduce((acc, p) => {
    if (!acc[p.processus]) acc[p.processus] = [];
    acc[p.processus].push(p);
    return acc;
  }, {});

  const assignedInSelectedProcessus = new Set(
    userPermissions
      .filter((p) => p.processus === selectedProcessus)
      .map((p) => String(p.indicateur || '').trim())
      .filter(Boolean)
  );

  const selectableIndicateurs = indicateursList.filter((ind) => !assignedInSelectedProcessus.has(ind));

  const toggleIndicateur = (indicateur) => {
    setSelectedIndicateurs((prev) =>
      prev.includes(indicateur)
        ? prev.filter((item) => item !== indicateur)
        : [...prev, indicateur]
    );
  };

  const selectAllIndicateurs = () => {
    setSelectedIndicateurs(selectableIndicateurs);
  };

  return (
    <div className={`permissions-management ${isDark ? 'theme-dark' : 'theme-light'}`}>
      {/* Header */}
      <div className="management-header">
        <div className="header-left">
          <h2>Gestion des Permissions</h2>
          <p>Attribuez ou retirez l'accès aux processus et indicateurs par utilisateur</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={handleCloseAlert} className="alert-close">×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
          <button onClick={handleCloseAlert} className="alert-close">×</button>
        </div>
      )}

      <div className="management-content">
        {/* ── Left panel: User list ── */}
        <div className="user-selection">
          <h3>Utilisateurs</h3>
          {loadingUsers ? (
            <div className="loading">Chargement…</div>
          ) : (
            <div className="user-list">
              {users.map((user, index) => (
                <div
                  key={`${user.id}-${user.username || index}`}
                  className={`user-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className={`user-role ${user.isAdmin ? 'admin' : 'user'}`}>
                      {user.isAdmin ? 'Administrateur' : 'Utilisateur'}
                    </div>
                  </div>
                  <div className="user-perm-count">
                    <span className="perm-badge">
                      {allPermissions.filter((p) => p.user_id === user.id).length} perm.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: Permissions ── */}
        {selectedUser ? (
          <div className="permissions-panel">
            {/* Panel header */}
            <div className="panel-header">
              <h3>Permissions de <em>{selectedUser.username}</em></h3>
              <div className={`user-badge ${selectedUser.isAdmin ? 'admin' : 'user'}`}>
                {selectedUser.isAdmin ? 'Admin' : 'User'}
              </div>
            </div>

            {/* Add permission form */}
            <div className="add-permission-form">
              <h4>➕ Ajouter une permission</h4>
              <div className="form-row">
                {/* Processus selector */}
                <div className="form-group">
                  <label>Processus</label>
                  {loadingProcessus ? (
                    <div className="loading-inline">Chargement…</div>
                  ) : (
                    <select
                      className="form-select"
                      value={selectedProcessus}
                      onChange={(e) => setSelectedProcessus(e.target.value)}
                    >
                      <option value="">— Choisir un processus —</option>
                      {processusList.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Indicateur multi-selector */}
                <div className="form-group form-group-indicators">
                  <label>Indicateurs (1 à N)</label>
                  {loadingIndicateurs ? (
                    <div className="loading-inline">Chargement…</div>
                  ) : !selectedProcessus ? (
                    <div className="loading-inline">Sélectionnez un processus.</div>
                  ) : (
                    <div className="indicator-picker">
                      <div className="indicator-picker-toolbar">
                        <span className="indicator-picker-summary">
                          {selectedIndicateurs.length} sélectionné(s) / {selectableIndicateurs.length} disponible(s)
                        </span>
                        <div className="indicator-picker-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={selectAllIndicateurs}
                            disabled={saving || selectableIndicateurs.length === 0}
                          >
                            Tout sélectionner
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedIndicateurs([])}
                            disabled={saving || selectedIndicateurs.length === 0}
                          >
                            Effacer
                          </button>
                        </div>
                      </div>

                      {selectableIndicateurs.length === 0 ? (
                        <div className="loading-inline">
                          Tous les indicateurs de ce processus sont déjà attribués.
                        </div>
                      ) : (
                        <div className="indicator-checkbox-list">
                          {selectableIndicateurs.map(([indicateur, designation]) => (
                            <label key={indicateur} className="indicator-checkbox-item">
                              <input
                                type="checkbox"
                                checked={selectedIndicateurs.includes(indicateur)}
                                onChange={() => toggleIndicateur(indicateur)}
                                disabled={saving}
                              />
                              <span title={indicateur}>{designation || indicateur}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Add button */}
                <div className="form-group form-group-btn">
                  <label>&nbsp;</label>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddPermission}
                    disabled={saving || !selectedProcessus || selectedIndicateurs.length === 0}
                  >
                    {saving ? 'Ajout…' : `Ajouter (${selectedIndicateurs.length})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing permissions list */}
            <div className="permissions-list">
              <h4>
                Permissions actuelles
                <span className="count-badge">{userPermissions.length}</span>
              </h4>

              {loadingPerms ? (
                <div className="loading">Chargement des permissions…</div>
              ) : userPermissions.length === 0 ? (
                <div className="empty-state">
                  <span>🔒</span>
                  <p>Aucune permission attribuée.</p>
                  <small>Utilisez le formulaire ci-dessus pour en ajouter.</small>
                </div>
              ) : (
                Object.entries(grouped).map(([processus, perms]) => (
                  <div key={processus} className="perm-group">
                    <div className="perm-group-header">
                      <span className="perm-processus-label">📁 {processus}</span>
                      <span className="perm-count">{perms.length} indicateur(s)</span>
                    </div>
                    <div className="perm-items">
                      {perms.map((perm) => (
                        <div key={perm.id} className="permission-item">
                          <div className="permission-info">
                            <span className="perm-indicateur-icon">📊</span>
                            <span className="permission-title">{perm.indicateur}</span>
                          </div>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemovePermission(perm.id)}
                            disabled={removingId === perm.id}
                          >
                            {removingId === perm.id ? '…' : '🗑 Retirer'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="panel-actions">
              <button className="btn btn-outline" onClick={() => setSelectedUser(null)}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div className="permissions-panel permissions-panel-empty">
            <div className="empty-state centered">
              <span>👈</span>
              <p>Sélectionnez un utilisateur pour gérer ses permissions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsManagement;

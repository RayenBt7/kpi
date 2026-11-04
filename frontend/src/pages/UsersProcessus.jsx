import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaTrash } from "react-icons/fa";

import api, {
  updateDashboardIndicatorUser,
} from '../services/api';
import '../styles/UsersProcessus.css';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeType = (value) => {
  const type = normalizeText(value).toLowerCase();
  return ['user', 'responsable', 'pilote'].includes(type) ? type : 'user';
};

const buildIndicators = (rows) => {
  const byIndicator = new Map();

  (rows || []).forEach((row) => {
    const indicateur = normalizeText(row?.Indicateur);
    if (!indicateur) return;

    const existing = byIndicator.get(indicateur) || {
      indicateur,
      Nordre: row?.Nordre, // Include Nordre for delete functionality
      designation: '',
      pilote: '',
      responsable: '',
      assignedUser: '',
      assignedUserId: null,
    };

    const designation = normalizeText(row?.Designation);
    const pilote = normalizeText(row?.Pilote);
    const responsable = normalizeText(row?.Responsable);
    const assignedUser = normalizeText(row?.UserName);
    const assignedUserId = row?.UserId ?? row?.userId ?? null;

    if (!existing.designation && designation) {
      existing.designation = designation;
    }

    if (!existing.pilote && pilote) {
      existing.pilote = pilote;
    }

    if (!existing.responsable && responsable) {
      existing.responsable = responsable;
    }

    if (!existing.assignedUser && assignedUser) {
      existing.assignedUser = assignedUser;
    }

    if (!existing.assignedUserId && assignedUserId) {
      existing.assignedUserId = assignedUserId;
    }

    // Keep the first Nordre if already set, otherwise update
    if (!existing.Nordre && row?.Nordre) {
      existing.Nordre = row.Nordre;
    }

    byIndicator.set(indicateur, existing);
  });

  return [...byIndicator.values()].sort((a, b) =>
    (a.designation || a.indicateur).localeCompare((b.designation || b.indicateur), 'fr', {
      sensitivity: 'base',
    })
  );
};

const UsersProcessus = ({ theme = 'dark' }) => {
  const [processusData, setProcessusData] = useState([]);
  const [selectedProcessus, setSelectedProcessus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [success, setSuccess] = useState('');
  const [updatingCell, setUpdatingCell] = useState('');


  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const [processusRes, usersRes] = await Promise.all([
        api.get('/api/dashboard/processus'),
        api.get('/api/admin/users'),
      ]);
      const processusList = Array.isArray(processusRes.data?.processus)
        ? [...new Set(processusRes.data.processus.map((item) => normalizeText(item)).filter(Boolean))]
        : [];
      setUsersList(
        (Array.isArray(usersRes.data?.users) ? usersRes.data.users : []).map((user) => ({
          ...user,
          username: normalizeText(user?.username),
          userType: normalizeType(user?.userType),
        }))
      );

      const processResponses = await Promise.allSettled(
        processusList.map((processus) =>
          api.get(`/api/dashboard/processus/${encodeURIComponent(processus)}`)
        )
      );

      const failedProcessus = [];
      const dashboardRows = processusList.map((processus, index) => {
        const response = processResponses[index];
        if (response.status !== 'fulfilled') {
          failedProcessus.push(processus);
          return {
            processus,
            indicators: [],
          };
        }

        const rows = Array.isArray(response.value?.data?.rows) ? response.value.data.rows : [];
        const indicators = buildIndicators(rows);

        return {
          processus,
          indicators,
        };
      });

      setProcessusData(dashboardRows);
      setSelectedProcessus((prev) => {
        if (!prev) return '';
        return dashboardRows.some((item) => item.processus === prev) ? prev : '';
      });

      if (failedProcessus.length > 0) {
        setError(`Certains processus n'ont pas pu etre charges: ${failedProcessus.join(', ')}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger la vue processus.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

const tableRows = useMemo(() => {
    const term = normalizeText(searchTerm).toLowerCase();

    return processusData
      .filter((group) => !selectedProcessus || group.processus === selectedProcessus)
      .flatMap((group) =>
        group.indicators.map((indicator) => ({
          processus: group.processus,
          indicateur: indicator.indicateur,
          Nordre: indicator.Nordre, // Include Nordre for delete functionality
          designation: indicator.designation || indicator.indicateur,
          pilote: indicator.pilote,
          responsable: indicator.responsable,
          user: indicator.assignedUser,
          userId: indicator.assignedUserId,
        }))
      )
      .filter((row) => {
        if (!term) return true;

        const haystack = [
          normalizeText(row.processus),
          normalizeText(row.indicateur),
          normalizeText(row.designation),
          normalizeText(row.pilote),
          normalizeText(row.responsable),
          normalizeText(row.user),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(term);
      });
  }, [processusData, searchTerm, selectedProcessus]);
  const handleDeleteProcessus = (processus) => {
    setSelectedId(processus);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/api/indicateurs/${selectedId}`);
      setModalOpen(false);
      // Reload data after successful deletion
      await loadData({ silent: true });
    } catch (error) {
      setError(error.response?.data?.error || 'Impossible de supprimer le processus.');
    }
  }

  const groupedTableRows = useMemo(() => {
    const groups = new Map();

    tableRows.forEach((row) => {
      const group = groups.get(row.processus) || {
        processus: row.processus,
        rows: [],
        pilote: '',
        responsable: '',
      };

      group.rows.push(row);
      if (!group.pilote && normalizeText(row.pilote)) {
        group.pilote = normalizeText(row.pilote);
      }
      if (!group.responsable && normalizeText(row.responsable)) {
        group.responsable = normalizeText(row.responsable);
      }

      groups.set(row.processus, group);
    });

    return [...groups.values()];
  }, [tableRows]);

  const roleOptions = useMemo(() => ({
    pilotes: usersList
      .filter((item) => normalizeType(item?.userType) === 'pilote' && normalizeText(item?.username))
      .map((item) => normalizeText(item.username)),
    responsables: usersList
      .filter((item) => normalizeType(item?.userType) === 'responsable' && normalizeText(item?.username))
      .map((item) => normalizeText(item.username)),
    users: usersList
      .filter((item) => item?.id && normalizeType(item?.userType) === 'user' && normalizeText(item?.username))
      .map((item) => ({
        id: item.id,
        username: normalizeText(item.username),
      })),
  }), [usersList]);

  const updateRole = async (row, field, value) => {
    const rowKey = field === 'user' ? `${row.processus}::${row.indicateur}` : row.processus;
    setUpdatingCell(`${field}:${rowKey}`);
    setError('');
    setSuccess('');

    try {
      if (field === 'pilote') {
        await api.put(`/api/dashboard/processus/${encodeURIComponent(row.processus)}/pilote`, {
          pilote: value,
        });
      } else if (field === 'responsable') {
        await api.put(`/api/dashboard/processus/${encodeURIComponent(row.processus)}/responsable`, {
          responsable: value,
        });
      } else {
        await updateDashboardIndicatorUser(row.indicateur, value ? Number(value) : null);
      }

      setSuccess('Affectation mise a jour avec succes.');
      await loadData({ silent: true });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details || "Impossible de mettre a jour l'affectation.");
    } finally {
      setUpdatingCell('');
    }
  };

  const renderRoleSelect = (row, field, processRoleValue = '') => {
    const rowKey = field === 'user' ? `${row.processus}::${row.indicateur}` : row.processus;
    const isUpdating = updatingCell === `${field}:${rowKey}`;

    if (field === 'user') {
      return (
        <select
          className="users-processus-role-select"
          value={row.userId || ''}
          disabled={isUpdating}
          onChange={(event) => updateRole(row, field, event.target.value)}
        >
          <option value="">Aucun user</option>
          {roleOptions.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
      );
    }

    const options = field === 'pilote' ? roleOptions.pilotes : roleOptions.responsables;
    return (
      <select
        className="users-processus-role-select"
        value={processRoleValue}
        disabled={isUpdating}
        onChange={(event) => updateRole(row, field, event.target.value)}
      >
        <option value="">{field === 'pilote' ? 'Aucun pilote' : 'Aucun responsable'}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    );
  };
  const renderRoleCell = (value) => {
    const label = normalizeText(value);

    if (!label) {
      return <span className="users-processus-muted">-</span>;
    }


    return (
      <span className="users-processus-role">
        <span className="users-processus-check">{'\u2713'}</span>
        <span>{label}</span>
      </span>
    );
  };


  return (
    <div className={`users-processus ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <div className="users-processus-header">
        <div>
          <h2>Vue Complete Processus & Roles</h2>
          <p>Table complete des processus, indicateurs, pilotes, responsables et users.</p>
        </div>
        <button
          type="button"
          className="users-processus-refresh-btn"
          onClick={() => loadData({ silent: true })}
          disabled={loading || refreshing}
        >
          {refreshing ? 'Rafraichissement...' : 'Rafraichir'}
        </button>
      </div>

      {error && (
        <div className="users-processus-alert users-processus-alert-error">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>x</button>
        </div>
      )}
      {success && (
        <div className="users-processus-alert users-processus-alert-success">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')}>x</button>
        </div>
      )}

      <div className="users-processus-filters">
        <label className="users-processus-filter">
          Filtrer par processus
          <select
            value={selectedProcessus}
            onChange={(event) => setSelectedProcessus(event.target.value)}
          >
            <option value="">Tous les processus</option>
            {processusData.map((group) => (
              <option key={group.processus} value={group.processus}>
                {group.processus}
              </option>
            ))}
          </select>
        </label>

        <label className="users-processus-filter users-processus-filter-grow">
          Rechercher
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Processus, indicateur, pilote, responsable ou user..."
          />
        </label>
      </div>

      {loading ? (
        <div className="users-processus-loading">Chargement du dashboard...</div>
      ) : tableRows.length === 0 ? (
        <div className="users-processus-empty">Aucun resultat pour les filtres actuels.</div>
      ) : (
        <div className="users-processus-card">
          <div className="users-processus-table-wrap">
            <table className="users-processus-table">
              <thead>
                <tr>
                  <th>Processus</th>
                  <th>Indicateur</th>
                  <th>Pilote</th>
                  <th>Responsable</th>
                  <th>User</th>
                  <th>Delete Indicateur</th>
                </tr>
              </thead>
              <tbody>
                {groupedTableRows.flatMap((group) =>
                  group.rows.map((row, rowIndex) => {
                    const rowKey = `${row.processus}::${row.indicateur}`;
                    return (
                      <tr key={rowKey}>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className="users-processus-process-name-cell">
                            {group.processus}
                          </td>
                        )}
                        <td>{row.designation}</td>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className="users-processus-process-role-cell">
                            {renderRoleSelect(row, 'pilote', group.pilote)}
                          </td>
                        )}
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className="users-processus-process-role-cell">
                            {renderRoleSelect(row, 'responsable', group.responsable)}
                          </td>
                        )}
                        <td>{renderRoleSelect(row, 'user')}</td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteProcessus(row.Nordre)}
                          >
                            <FaTrash className='delete-icon'/>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-processus-title">
          <div className="modal-content">
            <div className="modal-danger-icon">
              <FaTrash />
            </div>
            <h3 id="delete-processus-title">Confirmation</h3>
            <p>Etes-vous sur de vouloir supprimer ce processus ?</p>

            <div className="modal-buttons">
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={() => setModalOpen(false)}
              >
                Annuler
              </button>

              <button
                type="button"
                className="modal-btn modal-btn-delete"
                onClick={confirmDelete}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersProcessus;


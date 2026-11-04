import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import '../styles/Admin.css';

const Admin = ({ theme = 'dark' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDark = theme === 'dark';

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/admin/users');
      setUsers(response.data.users);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleAdmin = async (userId, currentAdminStatus) => {
    try {
      setError('');
      setSuccess('');
      
      const response = await api.put(`/api/admin/users/${userId}/admin`, {
        isAdmin: !currentAdminStatus
      });
      
      setSuccess(response.data.message);
      fetchUsers(); // Refresh user list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update admin status');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const response = await api.delete(`/api/admin/users/${userId}`);
      
      setSuccess(response.data.message);
      fetchUsers(); // Refresh user list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleCloseAlert = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className={`admin-page ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <p>Manage users and their admin privileges</p>
           
	    </div>

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

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="users-table-container">
            <table className={`users-table ${isDark ? 'table-dark' : 'table-light'}`}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Admin Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="no-users">No users found</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td data-label="ID">{user.id}</td>
                      <td data-label="Username">{user.username}</td>
                      <td data-label="Admin Status">
                        <span className={`status-badge ${user.isAdmin ? 'status-admin' : 'status-user'}`}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="actions-cell" data-label="Actions">
                        <button
                          onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                          className={`btn ${user.isAdmin ? 'btn-warning' : 'btn-primary'}`}
                        >
                          {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="btn btn-danger"
                          disabled={user.isAdmin} // Don't allow deleting admins for safety
                        >
                          Delete
                        </button>
                      </td>
					  
                    </tr>
					
                  ))
                )}
				
              </tbody>
            </table>
			
          </div>
		  
        )}
		
      </div>
    </div>
  );
};

export default Admin;

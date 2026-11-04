/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import '../styles/SystemSettings.css';

const SystemSettings = ({ theme = 'dark' }) => {
  const [settings, setSettings] = useState({
    appName: 'AAF Dashboard',
    maxUsers: 100,
    enableRegistration: true,
    theme: 'dark',
    notifications: true,
    dataRetentionDays: 365
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDark = theme === 'dark';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      // In a real system, you would fetch settings from the backend
      // For now, we'll use mock data
      setSettings({
        appName: 'AAF Dashboard',
        maxUsers: 100,
        enableRegistration: true,
        theme: 'dark',
        notifications: true,
        dataRetentionDays: 365
      });
    } catch (error) {
      setError('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setError('');
      setSuccess('');
      
      // In a real system, you would send the settings to the backend
      // For now, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError('Failed to save settings');
    }
  };

  const handleResetSettings = () => {
    setSettings({
      appName: 'AAF Dashboard',
      maxUsers: 100,
      enableRegistration: true,
      theme: 'dark',
      notifications: true,
      dataRetentionDays: 365
    });
    setSuccess('Settings reset to defaults');
  };

  const handleCloseAlert = () => {
    setError('');
    setSuccess('');
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className={`system-settings ${isDark ? 'theme-dark' : 'theme-light'}`}>
      {/* Header */}
      <div className="management-header">
        <div className="header-left">
          <h2>System Settings</h2>
          <p>Configure system-wide settings and preferences</p>
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

      {loading ? (
        <div className="loading">Loading settings...</div>
      ) : (
        <div className="settings-content">
          <div className="settings-grid">
            {/* General Settings */}
            <div className="settings-section">
              <h3>General</h3>
              <div className="setting-item">
                <label className="setting-label">
                  Application Name
                  <span className="setting-description">The name displayed in the application</span>
                </label>
                <input
                  type="text"
                  value={settings.appName}
                  onChange={(e) => handleInputChange('appName', e.target.value)}
                  className="setting-input"
                />
              </div>
              <div className="setting-item">
                <label className="setting-label">
                  Maximum Users
                  <span className="setting-description">Maximum number of registered users</span>
                </label>
                <input
                  type="number"
                  value={settings.maxUsers}
                  onChange={(e) => handleInputChange('maxUsers', parseInt(e.target.value))}
                  className="setting-input"
                  min="1"
                  max="1000"
                />
              </div>
              <div className="setting-item">
                <label className="setting-toggle">
                  <span className="setting-label">
                    Enable User Registration
                    <span className="setting-description">Allow new users to register accounts</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enableRegistration}
                    onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Theme Settings */}
            <div className="settings-section">
              <h3>Theme</h3>
              <div className="setting-item">
                <label className="setting-label">
                  Default Theme
                  <span className="setting-description">Default theme for new users</span>
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => handleInputChange('theme', e.target.value)}
                  className="setting-select"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="settings-section">
              <h3>Notifications</h3>
              <div className="setting-item">
                <label className="setting-toggle">
                  <span className="setting-label">
                    Enable Notifications
                    <span className="setting-description">Allow system notifications</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => handleInputChange('notifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="setting-item">
                <label className="setting-label">
                  Data Retention (Days)
                  <span className="setting-description">How long to keep user data</span>
                </label>
                <input
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) => handleInputChange('dataRetentionDays', parseInt(e.target.value))}
                  className="setting-input"
                  min="30"
                  max="3650"
                />
              </div>
            </div>

            {/* System Information */}
            <div className="settings-section">
              <h3>System Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Version</span>
                  <span className="info-value">1.0.0</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Database</span>
                  <span className="info-value">SQLite</span>
                </div>
                <div className="info-item">
                  <span className="info-label">API Status</span>
                  <span className="info-value status-active">Online</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Backup</span>
                  <span className="info-value">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="settings-actions">
            <button className="btn btn-outline" onClick={handleResetSettings}>
              Reset to Defaults
            </button>
            <button className="btn btn-primary" onClick={handleSaveSettings}>
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
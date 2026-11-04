import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/loginRegister.css';

export default function ResetPassword({ theme = 'dark', onToggleTheme }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [tokenValid, setTokenValid] = useState(null); // null = checking, true/false
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/api/auth/verify-reset-token?token=${token}`);
        setTokenValid(res.data.valid);
        setUsername(res.data.username || '');
      } catch {
        setTokenValid(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/kpi', { replace: true }), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la réinitialisation. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`login-page ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      {onToggleTheme && (
        <button type="button" className="login-theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </button>
      )}

      <div className="login-container" style={{ minHeight: '400px', maxWidth: '460px', width: '100%' }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Checking token */}
          {tokenValid === null && (
            <div style={{ textAlign: 'center', opacity: 0.6, padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p>Vérification du lien…</p>
            </div>
          )}

          {/* Token invalid/expired */}
          {tokenValid === false && (
            <div style={{ textAlign: 'center', padding: '0 40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Lien invalide ou expiré</h1>
              <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Ce lien de réinitialisation est invalide ou a expiré (30 min).
                Veuillez en demander un nouveau.
              </p>
              <Link
                to="/forgot-password"
                style={{
                  display: 'inline-block',
                  padding: '10px 30px',
                  background: '#512da8',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: '1rem',
                }}
              >
                Demander un nouveau lien
              </Link>
              <br />
              <Link
                to="/kpi"
                style={{ fontSize: '13px', color: theme === 'dark' ? '#93c5fd' : '#1d4ed8', textDecoration: 'none' }}
              >
                ← Retour à la connexion
              </Link>
            </div>
          )}

          {/* Token valid — show form */}
          {tokenValid === true && !success && (
            <form onSubmit={handleSubmit} style={{ width: '100%', padding: '0 40px' }}>
              <h1 style={{ marginBottom: '0.25rem' }}>Nouveau mot de passe</h1>
              {username && (
                <p style={{ fontSize: '13px', opacity: 0.65, marginBottom: '1.25rem', textAlign: 'center' }}>
                  Pour le compte : <strong>{username}</strong>
                </p>
              )}

              {error && <p className="error">{error}</p>}

              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ paddingRight: '2.5rem' }}
                />
              </div>

              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '0.25rem',
                  opacity: 0.7,
                  alignSelf: 'flex-start',
                }}
              >
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                Afficher le mot de passe
              </label>

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div style={{ width: '100%', marginTop: '0.5rem' }}>
                  <div style={{ height: '4px', borderRadius: '2px', background: '#e5e7eb', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: newPassword.length >= 12 ? '100%' : newPassword.length >= 8 ? '66%' : '33%',
                        background: newPassword.length >= 12 ? '#22c55e' : newPassword.length >= 8 ? '#f59e0b' : '#ef4444',
                        transition: 'all 0.3s',
                      }}
                    />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: newPassword.length >= 12 ? '#22c55e' : newPassword.length >= 8 ? '#f59e0b' : '#ef4444',
                  }}>
                    {newPassword.length >= 12 ? 'Fort' : newPassword.length >= 8 ? 'Moyen' : 'Faible'}
                  </span>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} style={{ width: '100%', marginTop: '1rem' }}>
                {isSubmitting ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <Link
                  to="/kpi"
                  style={{
                    fontSize: '13px',
                    color: theme === 'dark' ? '#93c5fd' : '#1d4ed8',
                    textDecoration: 'none',
                  }}
                >
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          )}

          {/* Success */}
          {success && (
            <div style={{ textAlign: 'center', padding: '0 40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Mot de passe réinitialisé !</h1>
              <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Votre mot de passe a été mis à jour avec succès.
                Vous allez être redirigé vers la page de connexion…
              </p>
              <Link
                to="/kpi"
                style={{
                  display: 'inline-block',
                  padding: '10px 30px',
                  background: '#512da8',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Se connecter maintenant
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

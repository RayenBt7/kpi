import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/loginRegister.css';

export default function ForgotPassword({ theme = 'dark', onToggleTheme }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
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

      <div className="login-container" style={{ minHeight: '360px', maxWidth: '460px', width: '100%' }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!sent ? (
            <form onSubmit={handleSubmit} style={{ width: '100%', padding: '0 40px' }}>
              <h1 style={{ marginBottom: '0.5rem' }}>Mot de passe oublié</h1>
              <p style={{ marginBottom: '1.5rem', fontSize: '13px', opacity: 0.7, textAlign: 'center' }}>
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>

              {error && <p className="error">{error}</p>}

              <input
                type="email"
                placeholder="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              <button type="submit" disabled={isSubmitting} style={{ width: '100%', marginTop: '1rem' }}>
                {isSubmitting ? 'Envoi en cours…' : 'Envoyer le lien'}
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
          ) : (
            <div style={{ textAlign: 'center', padding: '0 40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
              <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Email envoyé !</h1>
              <p style={{ fontSize: '13px', opacity: 0.75, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Si l'adresse <strong>{email}</strong> est associée à un compte,
                vous recevrez un lien de réinitialisation valable <strong>30 minutes</strong>.
              </p>
              <p style={{ fontSize: '12px', opacity: 0.55, marginBottom: '1.5rem' }}>
                Vérifiez aussi vos spams si vous ne voyez pas l'email.
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
                Retour à la connexion
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

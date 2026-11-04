import React, { useState } from "react";
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/loginRegister.css';
import { FaHome } from "react-icons/fa";

export default function LoginRegister({ onLogin, theme = 'dark', onToggleTheme }) {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [signUpForm, setSignUpForm] = useState({ username: '', password: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/api/auth/login', {
        username: loginForm.username.trim(),
        password: loginForm.password,
      });

      if (onLogin) {
        onLogin({
          ...response.data.user,
          token: response.data.token,
        });
      }

      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/api/auth/register', {
        username: signUpForm.username.trim(),
        password: signUpForm.password,
      });

      if (onLogin) {
        onLogin({
          ...response.data.user,
          token: response.data.token,
        });
      }

      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`login-page ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <button type="button" className="login-theme-toggle" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}

      </button>
      <button className="login-home-toggle" onClick={() => navigate('/')}>
        <FaHome />
      </button>
      <div className={`login-container ${isActive ? "active" : ""}`}>
        {/* SIGN UP */}
        <div className="form-container sign-up">
          <form onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            
            <span>or use your email for registration</span>
            {error && <p className="error">{error}</p>}
            <input
              type="text"
              placeholder="Username"
              value={signUpForm.username}
              onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={signUpForm.password}
              onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
              required
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Sign Up'}
            </button>
          </form>
        </div>

        {/* SIGN IN */}
        <div className="form-container sign-in">
          <form onSubmit={handleLogin}>
            <h1>Sign In</h1>
            <div className="social-icons">
              
            </div>
            <span>or use your email password</span>
            {error && <p className="error">{error}</p>}
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
            <Link to="/forgot-password" style={{ color: 'inherit' }}>Forgot your password?</Link>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* RIGHT / LEFT PANEL */}
        <div className="lr-toggle-container">
          <div className="lr-toggle">
            <div className="lr-toggle-panel lr-toggle-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button className="lr-hidden" onClick={() => setIsActive(false)}>Sign In</button>
            </div>
            <div className="lr-toggle-panel lr-toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to use all of site features</p>
              <button className="lr-hidden" onClick={() => setIsActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

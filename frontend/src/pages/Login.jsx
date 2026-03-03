import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import logo from '../assets/logo_2.png';
import { authApi, authStorage } from '../services/api';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await authApi.login({ username, password });
      const token = response?.data?.token;

      if (!token) {
        throw new Error('Token inválido');
      }

      authStorage.setToken(token);
      onLoginSuccess();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Usuário ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow" aria-hidden="true" />

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src={logo} alt="EDI Logo" className="login-logo" />
          <h1>EDI Life Manager</h1>
          <p>Faça login para acessar o sistema com segurança.</p>
        </div>

        <label className="login-field">
          <span>Usuário</span>
          <div className="login-input-wrapper">
            <User size={16} />
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
              required
            />
          </div>
        </label>

        <label className="login-field">
          <span>Senha</span>
          <div className="login-input-wrapper">
            <Lock size={16} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
          </div>
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={submitting} className="login-submit">
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

export default Login;

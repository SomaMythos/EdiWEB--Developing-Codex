import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { authApi } from '../services/api';
import './Login.css';

function Login({ defaultUsername = 'edi_admin', onLogin }) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authApi.login({ username, password });
      onLogin(response.data?.data?.token || '');
    } catch (err) {
      setError(err.response?.data?.detail || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="EDI" className="login-logo" />
        <h1>EDI Life Manager</h1>
        <p className="login-subtitle">Acesso protegido para uso via Cloudflare Tunnel</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Login
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

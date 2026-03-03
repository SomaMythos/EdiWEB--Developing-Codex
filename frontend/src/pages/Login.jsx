import { useState } from 'react';
import logo from '../assets/logo_2.png';
import { authApi } from '../services/api';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(password);
      const token = response?.data?.data?.token;
      if (!token) {
        throw new Error('Token não recebido');
      }
      onLoginSuccess(token);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Senha inválida. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={logo} alt="EDI Logo" className="login-logo" />
        <h1>EDI Life Manager</h1>
        <p>Digite sua senha para iniciar.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="edi-password">Senha</label>
          <input
            id="edi-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

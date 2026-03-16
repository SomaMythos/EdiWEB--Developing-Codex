import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Daily from './pages/Daily';
import Goals from './pages/Goals';
import Financeiro from './pages/Financeiro';
import Calendario from './pages/Calendario';
import Settings from './pages/Settings';
import HomePage from './pages/Home';
import Books from './pages/Books';
import HobbyVisualArts from './pages/HobbyVisualArts';
import NotificationsPage from './pages/Notifications';
import Music from './pages/music/Music';
import Games from './pages/Games';
import Watch from './pages/Watch';
import Shopping from './pages/Shopping';
import Consumiveis from './pages/Consumiveis';
import Anotacoes from './pages/Anotacoes';
import Login from './pages/Login';
import { authApi, setAuthToken } from './services/api';

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      setAuthToken(null);
      try {
        await authApi.status();
      } catch (_) {
        // backend ainda subindo
      }

      setIsAuthReady(true);
    };

    initializeAuth();
  }, []);

  const handleLoginSuccess = (token) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  if (!isAuthReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/anotacoes" element={<Anotacoes />} />
          <Route path="/anotacoes/diario" element={<Anotacoes />} />
          <Route path="/stats" element={<Navigate to="/" replace />} />
          <Route path="/reports" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/hobby/leitura" element={<Books />} />
          <Route path="/hobby/artes-visuais" element={<HobbyVisualArts />} />
          <Route path="/hobby/musica" element={<Music />} />
          <Route path="/hobby/games" element={<Games />} />
          <Route path="/hobby/assistir" element={<Watch />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/shopping/consumiveis" element={<Consumiveis />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reminders" element={<Navigate to="/notifications" replace />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

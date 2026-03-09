import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Daily from './pages/Daily';
import Goals from './pages/Goals';
import Financeiro from './pages/Financeiro';
import Calendario from './pages/Calendario';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
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
          <Route path="/" element={<Daily />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/anotacoes" element={<Anotacoes />} />
          <Route path="/stats" element={<Navigate to="/dashboard" replace />} />
          <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
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

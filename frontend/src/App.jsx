import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import { authApi, setAuthToken } from './services/api';

const HomePage = lazy(() => import('./pages/Home'));
const Daily = lazy(() => import('./pages/Daily'));
const Goals = lazy(() => import('./pages/Goals'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const Calendario = lazy(() => import('./pages/Calendario'));
const Settings = lazy(() => import('./pages/Settings'));
const Books = lazy(() => import('./pages/Books'));
const HobbyVisualArts = lazy(() => import('./pages/HobbyVisualArts'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const Music = lazy(() => import('./pages/music/Music'));
const Games = lazy(() => import('./pages/Games'));
const Watch = lazy(() => import('./pages/Watch'));
const Study = lazy(() => import('./pages/Study'));
const Shopping = lazy(() => import('./pages/Shopping'));
const Consumiveis = lazy(() => import('./pages/Consumiveis'));
const Anotacoes = lazy(() => import('./pages/Anotacoes'));

function RouteLoader() {
  return (
    <div className="route-loading page-shell">
      <p>Carregando módulo...</p>
    </div>
  );
}

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
        <Suspense fallback={<RouteLoader />}>
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
            <Route path="/hobby/estudo" element={<Study />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/shopping/consumiveis" element={<Consumiveis />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/reminders" element={<Navigate to="/notifications" replace />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;

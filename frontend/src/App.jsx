import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import Daily from './pages/Daily';
import Goals from './pages/Goals';
import Financeiro from './pages/Financeiro';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import HobbyVisualArts from './pages/HobbyVisualArts';
import Shopping from './pages/Shopping';
import Reminders from './pages/Reminders';
import Music from './pages/Music';
import Games from './pages/Games';
import Watch from './pages/Watch';
import './index.css';

const withTransition = (element) => <PageTransition>{element}</PageTransition>;

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={withTransition(<Daily />)} />
        <Route path="/goals" element={withTransition(<Goals />)} />
        <Route path="/financeiro" element={withTransition(<Financeiro />)} />
        <Route path="/stats" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={withTransition(<Dashboard />)} />
        <Route path="/hobby/leitura" element={withTransition(<Books />)} />
        <Route path="/hobby/artes-visuais" element={withTransition(<HobbyVisualArts />)} />
        <Route path="/hobby/musica" element={withTransition(<Music />)} />
        <Route path="/hobby/games" element={withTransition(<Games />)} />
        <Route path="/hobby/assistir" element={withTransition(<Watch />)} />
        <Route path="/shopping" element={withTransition(<Shopping />)} />
        <Route path="/reminders" element={withTransition(<Reminders />)} />
        <Route path="/settings" element={withTransition(<Settings />)} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </Router>
  );
}

export default App;

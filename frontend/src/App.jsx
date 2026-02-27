import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Daily from './pages/Daily';
import Goals from './pages/Goals';
import Financeiro from './pages/Financeiro';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import HobbyVisualArts from './pages/HobbyVisualArts';
import Reminders from './pages/Reminders';
import Music from "./pages/music/Music";
import Games from './pages/Games';
import Watch from './pages/Watch';
import ShoppingConsumiveis from './pages/ShoppingConsumiveis';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
  <Route path="/" element={<Daily />} />
  <Route path="/goals" element={<Goals />} />
  <Route path="/financeiro" element={<Financeiro />} />
  <Route path="/stats" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/hobby/leitura" element={<Books />} />
  <Route path="/hobby/artes-visuais" element={<HobbyVisualArts />} />
  <Route path="/hobby/musica" element={<Music />} />
  <Route path="/hobby/games" element={<Games />} />
  <Route path="/hobby/assistir" element={<Watch />} />
  <Route path="/shopping" element={<Navigate to="/shopping/consumiveis" replace />} />
  <Route path="/shopping/consumiveis" element={<ShoppingConsumiveis />} />
  <Route path="/reminders" element={<Reminders />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
      </Layout>
    </Router>
  );
}

export default App;

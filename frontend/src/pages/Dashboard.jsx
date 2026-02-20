import React, { useEffect, useState } from 'react';
import { dashboardApi, profileApi } from '../services/api';

const Dashboard = () => {
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState({ name: '', birth_date: '', height: '' });

  const load = async () => {
    const [ov, pr] = await Promise.all([dashboardApi.getOverview(), profileApi.get()]);
    setOverview(ov.data.data);
    if (pr.data.data) setProfile(pr.data.data);
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    await profileApi.save(profile);
    load();
  };

  return (
    <div className="page-container fade-in">
      <h1>Dashboard & Perfil</h1>
      <form onSubmit={saveProfile} className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Perfil</h3>
        <input className="input" placeholder="Nome" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
        <input className="input" placeholder="Nascimento (YYYY-MM-DD)" value={profile.birth_date || ''} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} />
        <input className="input" placeholder="Altura (m)" value={profile.height || ''} onChange={(e) => setProfile({ ...profile, height: e.target.value })} />
        <button className="btn btn-primary" type="submit">Salvar Perfil</button>
      </form>

      <div className="card" style={{ padding: 16 }}>
        <h3>Resumo de Hoje</h3>
        {!overview ? (
          <p style={{ opacity: 0.8 }}>Carregando resumo...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Atividades concluídas</div>
              <strong style={{ fontSize: 24 }}>{overview.completed_activities || 0}</strong>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Tempo total (min)</div>
              <strong style={{ fontSize: 24 }}>{overview.total_duration || 0}</strong>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Metas concluídas</div>
              <strong style={{ fontSize: 24 }}>{overview.completed_goals || 0}</strong>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Meta principal</div>
              <strong>{overview.top_goal || 'Sem meta ativa'}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

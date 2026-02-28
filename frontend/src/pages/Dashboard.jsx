import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Award, Calendar, Clock, Home, Target, TrendingUp } from 'lucide-react';
import {
  analyticsApi,
  dashboardApi,
  financeApi,
  goalsApi,
  profileApi,
  notificationsApi,
  shoppingApi,
} from '../services/api';
import './Stats.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState({ name: '', birth_date: '', height: '' });
  const [todayData, setTodayData] = useState(null);
  const [lastDaysData, setLastDaysData] = useState([]);
  const [topActivities, setTopActivities] = useState([]);
  const [goalsOverview, setGoalsOverview] = useState([]);
  const [moduleSummary, setModuleSummary] = useState({
    goals: 0,
    notifications: 0,
    shoppingPending: 0,
    financeFixedExpenses: 0,
  });

  const quickActions = useMemo(
    () => [
      { path: '/goals', label: 'Metas' },
      { path: '/financeiro', label: 'Financeiro' },
      { path: '/shopping', label: 'Shopping' },
      { path: '/notifications', label: 'Notificações' },
      { path: '/', label: 'Daily' },
    ],
    []
  );

  const formatMinutes = (minutes) => {
    const total = Number(minutes || 0);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const completionRateToday =
    todayData && todayData.planned > 0 ? Math.round((todayData.completed / todayData.planned) * 100) : 0;

  const averageCompletionRate =
    lastDaysData.length > 0
      ? Math.round(lastDaysData.reduce((sum, day) => sum + (day.completion_rate || 0), 0) / lastDaysData.length)
      : 0;

  const totalPeriodActivityTime = lastDaysData.reduce((sum, day) => sum + (day.executed_time || 0), 0);

  const loadData = async () => {
    setLoading(true);
    const [
      dashboardRes,
      profileRes,
      todayRes,
      lastDaysRes,
      topActivitiesRes,
      goalsOverviewRes,
      goalsRes,
      notificationsRes,
      shoppingStatsRes,
      financeExpensesRes,
    ] = await Promise.allSettled([
      dashboardApi.getOverview(),
      profileApi.get(),
      analyticsApi.getToday(),
      analyticsApi.getLastDays(selectedPeriod),
      analyticsApi.getTopActivities(5),
      analyticsApi.getGoalsOverview(),
      goalsApi.list(),
      notificationsApi.list({ status: 'unread', include_generated: true }),
      shoppingApi.stats(),
      financeApi.listFixedExpenses(),
    ]);

    if (dashboardRes.status === 'fulfilled') setOverview(dashboardRes.value?.data?.data || null);
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value?.data?.data || { name: '', birth_date: '', height: '' });
    if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data?.data || null);
    if (lastDaysRes.status === 'fulfilled') setLastDaysData(lastDaysRes.value?.data?.data || []);
    if (topActivitiesRes.status === 'fulfilled') setTopActivities(topActivitiesRes.value?.data?.data || []);
    if (goalsOverviewRes.status === 'fulfilled') setGoalsOverview(goalsOverviewRes.value?.data?.data || []);

    setModuleSummary({
      goals: goalsRes.status === 'fulfilled' ? (goalsRes.value?.data?.data || []).length : 0,
      notifications: notificationsRes.status === 'fulfilled' ? (notificationsRes.value?.data?.data || []).length : 0,
      shoppingPending:
        shoppingStatsRes.status === 'fulfilled' ? Number(shoppingStatsRes.value?.data?.data?.unbought_items || 0) : 0,
      financeFixedExpenses:
        financeExpensesRes.status === 'fulfilled' ? (financeExpensesRes.value?.data?.data || []).length : 0,
    });

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const saveProfile = async (e) => {
    e.preventDefault();
    await profileApi.save(profile);
    loadData();
  };

  return (
    <div className="page-container fade-in stats-page">
      <header className="stats-header">
        <div>
          <h1>
            <Home size={28} className="dashboard-title-icon" />
            Dashboard + Estatísticas
          </h1>
          <p>Tudo em um só lugar: desempenho, visão geral e atalhos dos outros menus.</p>
        </div>
        <div className="period-selector">
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              className={`btn ${selectedPeriod === period ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period} dias
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={saveProfile} className="card dashboard-profile-form">
        <h3>Perfil</h3>
        <input
          className="input"
          placeholder="Nome"
          value={profile.name || ''}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Nascimento (YYYY-MM-DD)"
          value={profile.birth_date || ''}
          onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
        />
        <input
          className="input"
          placeholder="Altura (m)"
          value={profile.height || ''}
          onChange={(e) => setProfile({ ...profile, height: e.target.value })}
        />
        <button className="btn btn-primary" type="submit">
          Salvar Perfil
        </button>
      </form>

      <div className="stats-overview">
        <h2>Resumo de Hoje</h2>
        <div className="overview-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><Activity size={24} /></div>
            <div className="stat-content"><p className="stat-label">Atividades concluídas</p><p className="stat-value">{overview?.completed_activities || todayData?.completed || 0}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><Award size={24} /></div>
            <div className="stat-content"><p className="stat-label">Metas concluídas</p><p className="stat-value">{overview?.completed_goals || 0}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><TrendingUp size={24} /></div>
            <div className="stat-content"><p className="stat-label">Taxa de conclusão</p><p className="stat-value">{completionRateToday}%</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon primary"><Clock size={24} /></div>
            <div className="stat-content"><p className="stat-label">Tempo executado</p><p className="stat-value">{formatMinutes(todayData?.executed_time || overview?.total_duration || 0)}</p></div>
          </div>
        </div>
      </div>

      <div className="period-summary">
        <h2>Integração dos outros menus</h2>
        <div className="overview-grid">
          <div className="stat-card"><div className="stat-icon primary"><Target size={24} /></div><div className="stat-content"><p className="stat-label">Metas cadastradas</p><p className="stat-value">{moduleSummary.goals}</p></div></div>
          <div className="stat-card"><div className="stat-icon warning"><Calendar size={24} /></div><div className="stat-content"><p className="stat-label">Notificações pendentes</p><p className="stat-value">{moduleSummary.notifications}</p></div></div>
          <div className="stat-card"><div className="stat-icon success"><Activity size={24} /></div><div className="stat-content"><p className="stat-label">Itens faltando no Shopping</p><p className="stat-value">{moduleSummary.shoppingPending}</p></div></div>
          <div className="stat-card"><div className="stat-icon primary"><Clock size={24} /></div><div className="stat-content"><p className="stat-label">Gastos fixos cadastrados</p><p className="stat-value">{moduleSummary.financeFixedExpenses}</p></div></div>
        </div>
        <div className="dashboard-quick-actions">
          {quickActions.map((item) => (
            <Link key={item.path} to={item.path} className="btn btn-secondary btn-sm">
              Abrir {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="top-activities-section card">
        <h2>Últimos {selectedPeriod} dias</h2>
        <div className="overview-grid dashboard-period-grid">
          <div className="stat-card"><div className="stat-content"><p className="stat-label">Taxa média</p><p className="stat-value">{averageCompletionRate}%</p></div></div>
          <div className="stat-card"><div className="stat-content"><p className="stat-label">Tempo total</p><p className="stat-value">{formatMinutes(totalPeriodActivityTime)}</p></div></div>
          <div className="stat-card"><div className="stat-content"><p className="stat-label">Dias ativos</p><p className="stat-value">{lastDaysData.filter((d) => (d.total || 0) > 0).length}</p></div></div>
        </div>

        {topActivities.length === 0 ? (
          <p className="empty-state">Nenhuma atividade concluída ainda</p>
        ) : (
          <div className="top-activities-list">
            {topActivities.map((activity, index) => (
              <div key={`${activity.title}-${index}`} className="top-activity-item">
                <div className="activity-rank">{index + 1}</div>
                <div className="activity-info"><h3>{activity.title}</h3><p>{activity.executions} execuções</p></div>
                <div className="activity-bar"><div className="activity-bar-fill" style={{ width: `${(activity.executions / topActivities[0].executions) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="goals-overview-section card">
        <h2>Visão Geral de Metas</h2>
        {goalsOverview.length === 0 ? (
          <p className="empty-state">Nenhuma meta cadastrada</p>
        ) : (
          <div className="goals-overview-grid">
            {goalsOverview.map((goal, index) => (
              <div key={`${goal.title}-${index}`} className={`goal-overview-card ${goal.stalled ? 'stalled' : ''}`}>
                <div className="goal-overview-header"><Target size={20} /><h3>{goal.title}</h3></div>
                <div className="goal-overview-progress"><p className="progress-text">{goal.progress}</p>{goal.stalled && <span className="stalled-badge">Parada</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="dashboard-loading">Atualizando dados...</p>}
    </div>
  );
};

export default Dashboard;

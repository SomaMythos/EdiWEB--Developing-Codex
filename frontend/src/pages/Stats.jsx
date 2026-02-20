import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Target, Clock, Calendar, Award } from 'lucide-react';
import { analyticsApi } from '../services/api';
import './Stats.css';

const Stats = () => {
  const [todayData, setTodayData] = useState(null);
  const [lastDaysData, setLastDaysData] = useState([]);
  const [topActivities, setTopActivities] = useState([]);
  const [goalsOverview, setGoalsOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      const [todayRes, lastDaysRes, topActivitiesRes, goalsRes] = await Promise.all([
        analyticsApi.getToday(),
        analyticsApi.getLastDays(selectedPeriod),
        analyticsApi.getTopActivities(5),
        analyticsApi.getGoalsOverview()
      ]);

      setTodayData(todayRes.data.data);
      setLastDaysData(lastDaysRes.data.data || []);
      setTopActivities(topActivitiesRes.data.data || []);
      setGoalsOverview(goalsRes.data.data || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getCompletionRate = () => {
    if (!todayData) return 0;
    if (todayData.planned === 0) return 0;
    return Math.round((todayData.completed / todayData.planned) * 100);
  };

  const getTotalActivityTime = () => {
    if (!lastDaysData || lastDaysData.length === 0) return 0;
    return lastDaysData.reduce((sum, day) => sum + (day.total_time || 0), 0);
  };

  const getAverageCompletionRate = () => {
    if (!lastDaysData || lastDaysData.length === 0) return 0;
    const validDays = lastDaysData.filter(day => day.total > 0);
    if (validDays.length === 0) return 0;
    
    const totalRate = validDays.reduce((sum, day) => {
      const rate = day.total > 0 ? (day.done / day.total) * 100 : 0;
      return sum + rate;
    }, 0);
    
    return Math.round(totalRate / validDays.length);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spin">⏳</div>
        <p>Carregando estatísticas...</p>
      </div>
    );
  }

  return (
    <div className="stats-page fade-in">
      <header className="page-header">
        <div>
          <h1>Estatísticas</h1>
          <p className="subtitle">Acompanhe seu desempenho e progresso</p>
        </div>
        <div className="period-selector">
          <button 
            className={`btn ${selectedPeriod === 7 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setSelectedPeriod(7)}
          >
            7 dias
          </button>
          <button 
            className={`btn ${selectedPeriod === 30 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setSelectedPeriod(30)}
          >
            30 dias
          </button>
          <button 
            className={`btn ${selectedPeriod === 90 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setSelectedPeriod(90)}
          >
            90 dias
          </button>
        </div>
      </header>

      {/* Today's Summary */}
      <div className="stats-overview">
        <h2>Resumo de Hoje</h2>
        <div className="overview-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Atividades Planejadas</p>
              <p className="stat-value">{todayData?.planned || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <Award size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Concluídas</p>
              <p className="stat-value">{todayData?.completed || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Taxa de Conclusão</p>
              <p className="stat-value">{getCompletionRate()}%</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon primary">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Tempo Executado</p>
              <p className="stat-value">{formatMinutes(todayData?.executed_time || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div className="period-summary">
        <h2>Últimos {selectedPeriod} Dias</h2>
        <div className="overview-grid">
          <div className="stat-card">
            <div className="stat-icon success">
              <Calendar size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Taxa Média de Conclusão</p>
              <p className="stat-value">{getAverageCompletionRate()}%</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Tempo Total</p>
              <p className="stat-value">{formatMinutes(getTotalActivityTime())}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon primary">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Dias Ativos</p>
              <p className="stat-value">{lastDaysData.filter(d => d.total > 0).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Activities */}
      <div className="top-activities-section card">
        <h2>Atividades Mais Frequentes</h2>
        {topActivities.length === 0 ? (
          <p className="empty-state">Nenhuma atividade concluída ainda</p>
        ) : (
          <div className="top-activities-list">
            {topActivities.map((activity, index) => (
              <div key={index} className="top-activity-item">
                <div className="activity-rank">{index + 1}</div>
                <div className="activity-info">
                  <h3>{activity.title}</h3>
                  <p>{activity.executions} execuções</p>
                </div>
                <div className="activity-bar">
                  <div 
                    className="activity-bar-fill" 
                    style={{ 
                      width: `${(activity.executions / topActivities[0].executions) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goals Overview */}
      <div className="goals-overview-section card">
        <h2>Visão Geral de Metas</h2>
        {goalsOverview.length === 0 ? (
          <p className="empty-state">Nenhuma meta cadastrada</p>
        ) : (
          <div className="goals-overview-grid">
            {goalsOverview.map((goal, index) => (
              <div key={index} className={`goal-overview-card ${goal.stalled ? 'stalled' : ''}`}>
                <div className="goal-overview-header">
                  <Target size={20} />
                  <h3>{goal.title}</h3>
                </div>
                <div className="goal-overview-progress">
                  <p className="progress-text">{goal.progress}</p>
                  {goal.stalled && (
                    <span className="stalled-badge">Parada</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Breakdown */}
      <div className="daily-breakdown card">
        <h2>Detalhamento Diário</h2>
        {lastDaysData.length === 0 ? (
          <p className="empty-state">Nenhum dado disponível</p>
        ) : (
          <div className="daily-breakdown-list">
            {lastDaysData.map((day, index) => (
              <div key={index} className="daily-item">
                <div className="daily-date">
                  {new Date(day.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </div>
                <div className="daily-stats">
                  <div className="daily-stat">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">{day.total || 0}</span>
                  </div>
                  <div className="daily-stat">
                    <span className="stat-label">Concluídas:</span>
                    <span className="stat-value success">{day.done || 0}</span>
                  </div>
                  <div className="daily-stat">
                    <span className="stat-label">Tempo:</span>
                    <span className="stat-value">{formatMinutes(day.total_time || 0)}</span>
                  </div>
                </div>
                <div className="daily-completion">
                  <div className="completion-bar">
                    <div 
                      className="completion-bar-fill"
                      style={{ 
                        width: `${day.total > 0 ? (day.done / day.total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span className="completion-rate">
                    {day.total > 0 ? Math.round((day.done / day.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;

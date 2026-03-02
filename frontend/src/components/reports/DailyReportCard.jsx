import React from 'react';
import { Activity, Calendar, Clock, TrendingUp } from 'lucide-react';

const DailyReportCard = ({
  overview,
  todayData,
  completionRateToday,
  averageCompletionRate,
  totalPeriodActivityTime,
  activeDays,
  selectedActivity,
  onSelectActivity,
  topActivities,
  formatMinutes,
}) => {
  const topExecutions = topActivities[0]?.executions || 1;

  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Daily</h2>
        <p>Resumo diário, consistência no período e detalhamento por atividade.</p>
      </header>

      <div className="report-grid report-grid--four">
        <div className="stat-card">
          <div className="stat-icon primary"><Activity size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Concluídas hoje</p>
            <p className="stat-value">{overview?.activities?.completed || todayData?.completed || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><TrendingUp size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Taxa hoje</p>
            <p className="stat-value">{completionRateToday}%</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Calendar size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Taxa média</p>
            <p className="stat-value">{averageCompletionRate}%</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><Clock size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Tempo acumulado</p>
            <p className="stat-value">{formatMinutes(totalPeriodActivityTime)}</p>
          </div>
        </div>
      </div>

      <div className="report-grid report-grid--split">
        <div className="activity-list-panel">
          <h3>Atividades mais frequentes</h3>
          {topActivities.length === 0 ? (
            <p className="empty-state">Sem atividades concluídas no período.</p>
          ) : (
            <div className="top-activities-list">
              {topActivities.map((activity, index) => (
                <button
                  key={activity.title}
                  type="button"
                  className={`top-activity-item ${selectedActivity?.title === activity.title ? 'is-selected' : ''}`}
                  onClick={() => onSelectActivity(activity)}
                >
                  <div className="activity-rank">{index + 1}</div>
                  <div className="activity-info">
                    <h3>{activity.title}</h3>
                    <p>{activity.executions} execuções</p>
                  </div>
                  <div className="activity-bar">
                    <div className="activity-bar-fill" style={{ width: `${(activity.executions / topExecutions) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="activity-detail-panel">
          <h3>Visão detalhada por atividade</h3>
          {selectedActivity ? (
            <>
              <p className="activity-detail-title">{selectedActivity.title}</p>
              <div className="activity-detail-stats">
                <p><strong>{selectedActivity.executions}</strong> execuções</p>
                <p><strong>{activeDays}</strong> dias ativos no período</p>
                <p><strong>{formatMinutes(todayData?.executed_time || 0)}</strong> tempo executado hoje</p>
              </div>
            </>
          ) : (
            <p className="empty-state">Selecione uma atividade para ver detalhes.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default DailyReportCard;

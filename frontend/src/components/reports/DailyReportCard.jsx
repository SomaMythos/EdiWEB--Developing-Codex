import React from 'react';
import { Activity, Calendar, Clock, TrendingUp } from 'lucide-react';

const DailyReportCard = ({
  overview,
  todayData,
  completionRateToday,
  averageCompletionRate,
  totalPeriodActivityTime,
  activeDays,
  topActivities,
  selectedActivityId,
  onSelectActivity,
  activityDetail,
  dailyOverview,
  dailyStreaks,
  timeseries,
  formatMinutes,
}) => {
  const periodAverage =
    timeseries.length > 0
      ? Math.round(timeseries.reduce((sum, item) => sum + (item.completion_rate || 0), 0) / timeseries.length)
      : averageCompletionRate;

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
            <p className="stat-value">{overview?.activities?.completed || todayData?.done || 0}</p>
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
            <p className="stat-label">Taxa média período</p>
            <p className="stat-value">{periodAverage}%</p>
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
          <h3>Detalhe por atividade</h3>
          {topActivities.length === 0 ? (
            <p className="empty-state">Sem atividades concluídas no período.</p>
          ) : (
            <select
              className="activity-select"
              value={selectedActivityId || ''}
              onChange={(event) => onSelectActivity(Number(event.target.value))}
            >
              {topActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.title}
                </option>
              ))}
            </select>
          )}

          <div className="activity-detail-stats mt-sm">
            <p><strong>{dailyStreaks?.current_activity_streak || 0}</strong> dias seguidos com atividade concluída</p>
            <p><strong>{dailyStreaks?.current_perfect_daily_streak || 0}</strong> dias de perfect daily</p>
            <p><strong>{activeDays}</strong> dias ativos no período selecionado</p>
            <p><strong>{formatMinutes(dailyOverview?.month?.total_duration || 0)}</strong> no mês atual</p>
          </div>
        </div>

        <div className="activity-detail-panel">
          <h3>Curiosidades da atividade</h3>
          {activityDetail ? (
            <>
              <p className="activity-detail-title">{activityDetail.activity?.title}</p>
              <div className="activity-detail-stats">
                <p><strong>{activityDetail.week?.completed || 0}</strong> concluídas na semana ({activityDetail.week?.total || 0} no total)</p>
                <p><strong>{activityDetail.month?.completed || 0}</strong> concluídas no mês ({activityDetail.month?.total || 0} no total)</p>
                <p><strong>{formatMinutes(activityDetail.month?.total_duration || 0)}</strong> de duração no mês</p>
                <p><strong>{formatMinutes(activityDetail.month?.avg_duration || 0)}</strong> de duração média no mês</p>
                <p>
                  Melhor dia: <strong>{activityDetail.best_day?.date || '—'}</strong>
                </p>
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

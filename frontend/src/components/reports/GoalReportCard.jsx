import React from 'react';
import { Award, Target } from 'lucide-react';

const GoalReportCard = ({ overview, goalsOverview, totalGoals }) => {
  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Metas</h2>
        <p>Progresso geral e metas que precisam de atenção.</p>
      </header>

      <div className="report-grid report-grid--two">
        <div className="stat-card">
          <div className="stat-icon success"><Award size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Metas concluídas</p>
            <p className="stat-value">{overview?.goals?.completed || 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary"><Target size={20} /></div>
          <div className="stat-content">
            <p className="stat-label">Metas cadastradas</p>
            <p className="stat-value">{totalGoals}</p>
          </div>
        </div>
      </div>

      {goalsOverview.length === 0 ? (
        <p className="empty-state">Nenhuma meta cadastrada.</p>
      ) : (
        <div className="goals-overview-grid">
          {goalsOverview.map((goal) => (
            <div key={goal.title} className={`goal-overview-card ${goal.stalled ? 'stalled' : ''}`}>
              <div className="goal-overview-header">
                <Target size={18} />
                <h3>{goal.title}</h3>
              </div>
              <div className="goal-overview-progress">
                <p className="progress-text">{goal.progress}</p>
                {goal.stalled ? <span className="stalled-badge">Parada</span> : <span className="active-badge">Em curso</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default GoalReportCard;

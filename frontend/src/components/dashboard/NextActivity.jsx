import React from 'react';
import { Link } from 'react-router-dom';

export default function NextActivity({ nextActivity, formatDuration }) {
  return (
    <section className="home-block home-block--daily page-shell next-activity grainy distressed">
      <div className="home-block__header next-activity-header">
        <div>
          <div className="next-activity-kicker">Daily</div>
          <h1 className="next-activity-title">Próxima atividade</h1>
        </div>
        <Link to="/daily" className="home-block__link">Abrir daily</Link>
      </div>

      {nextActivity ? (
        <Link to={nextActivity.path} className="home-daily-link">
          <div
            className={`daily-block daily-block--${nextActivity.block_category || 'base'} home-daily-block next-activity-strip grainy distressed`}
          >
            <div className="daily-block__left next-time">
              <div className="daily-block__meta">
                <div className="daily-block__time next-time-main">
                  {nextActivity.start_time} - {nextActivity.end_time || '--:--'}
                </div>
                <div className="daily-block__duration next-time-sub">
                  {formatDuration(nextActivity.duration)}
                </div>
              </div>
            </div>
            <div className="daily-block__name next-name">{nextActivity.title}</div>
            <div className="home-daily-block__pill next-action now-badge">AGORA</div>
          </div>
        </Link>
      ) : (
        <div className="home-empty-state">Nenhuma atividade pendente programada para hoje.</div>
      )}
    </section>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Brush, Gamepad2, Headphones, Tv } from 'lucide-react';

const hobbyLinks = [
  { path: '/hobby/leitura', label: 'Leitura', icon: BookOpen },
  { path: '/hobby/artes-visuais', label: 'Artes Visuais', icon: Brush },
  { path: '/hobby/musica', label: 'Música', icon: Headphones },
  { path: '/hobby/games', label: 'Games', icon: Gamepad2 },
  { path: '/hobby/assistir', label: 'Assistir', icon: Tv },
];

const HobbyReportFeed = ({ topActivities }) => {
  const hobbyHighlights = topActivities.slice(0, 3);

  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Hobbies</h2>
        <p>Atividades de lazer com maior frequência e atalhos rápidos.</p>
      </header>

      <div className="hobby-feed-list">
        {hobbyHighlights.length === 0 ? (
          <p className="empty-state">Sem dados recentes de hobbies.</p>
        ) : (
          hobbyHighlights.map((item) => (
            <article key={item.title} className="hobby-feed-item">
              <h3>{item.title}</h3>
              <p>{item.executions} registros no período</p>
            </article>
          ))
        )}
      </div>

      <div className="dashboard-quick-actions">
        {hobbyLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.path} to={link.path} className="btn btn-secondary btn-sm">
              <Icon size={14} />
              Abrir {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default HobbyReportFeed;

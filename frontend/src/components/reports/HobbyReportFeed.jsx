import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Brush, Headphones, Tv } from 'lucide-react';

const hobbyLinks = [
  { path: '/hobby/leitura', label: 'Leitura', icon: BookOpen },
  { path: '/hobby/artes-visuais', label: 'Artes Visuais', icon: Brush },
  { path: '/hobby/musica', label: 'Música', icon: Headphones },
  { path: '/hobby/assistir', label: 'Assistir', icon: Tv },
];

const moduleLabels = {
  leitura: 'Leitura',
  artes: 'Artes',
  assistir: 'Assistir',
  musica: 'Música',
};

const HobbyReportFeed = ({ hobbyLog = [] }) => {
  const [activeModules, setActiveModules] = useState([]);

  const availableModules = useMemo(
    () => Object.entries(moduleLabels).map(([value, label]) => ({ value, label })),
    []
  );

  const filteredLog = useMemo(() => {
    if (!activeModules.length) return hobbyLog;
    return hobbyLog.filter((event) => activeModules.includes(event.module));
  }, [activeModules, hobbyLog]);

  const toggleModule = (moduleValue) => {
    setActiveModules((prev) =>
      prev.includes(moduleValue) ? prev.filter((item) => item !== moduleValue) : [...prev, moduleValue]
    );
  };

  return (
    <section className="report-module card">
      <header className="report-module-header">
        <h2>Timeline de Hobbies</h2>
        <p>Feed unificado de leitura, artes, assistir e música.</p>
      </header>

      <div className="dashboard-quick-actions" role="group" aria-label="Filtrar módulos de hobbies">
        {availableModules.map((moduleOption) => (
          <button
            key={moduleOption.value}
            className={`btn btn-sm ${activeModules.includes(moduleOption.value) ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => toggleModule(moduleOption.value)}
          >
            {moduleOption.label}
          </button>
        ))}
      </div>

      <div className="hobby-feed-list">
        {filteredLog.length === 0 ? (
          <p className="empty-state">Sem eventos no período selecionado.</p>
        ) : (
          filteredLog.map((item, index) => (
            <article key={`${item.timestamp}-${item.event_type}-${index}`} className="hobby-feed-item">
              <div className="hobby-feed-item__meta">
                <span className="stat-label">{moduleLabels[item.module] || item.module}</span>
                <span className="empty-state">{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.event_type.replaceAll('_', ' ')}</p>
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

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Coins, ReceiptText, ScrollText } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import '../components/daily/DailyTimeline.css';
import './Dashboard.css';

const SUGGESTION_ORDER = [
  { key: 'goal', label: 'Meta', empty: 'Nenhuma meta ativa agora.' },
  { key: 'reading', label: 'Leitura', empty: 'Nenhuma leitura em aberto.' },
  { key: 'music', label: 'Música', empty: 'Nada pendente em música.' },
  { key: 'watch', label: 'Assistir', empty: 'Nada pendente para assistir.' },
];

const nextIndexFor = (currentIndex, total) => {
  if (!total) return 0;
  if (total === 1) return 0;
  let candidate = currentIndex;
  while (candidate === currentIndex) {
    candidate = Math.floor(Math.random() * total);
  }
  return candidate;
};

const formatDuration = (minutes) => {
  const total = Number(minutes || 0);
  if (!total) return '0 min';
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
};

const getPlaceholderLabel = (label) => label.slice(0, 1).toUpperCase();

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [frontpage, setFrontpage] = useState(null);
  const [indexes, setIndexes] = useState({});

  useEffect(() => {
    let active = true;

    const loadFrontpage = async () => {
      setLoading(true);
      try {
        const response = await dashboardApi.getFrontpage();
        if (!active) return;
        const data = response?.data?.data || null;
        setFrontpage(data);
        setIndexes(
          SUGGESTION_ORDER.reduce((accumulator, group) => {
            const total = data?.suggestion_groups?.[group.key]?.items?.length || 0;
            accumulator[group.key] = total ? Math.floor(Math.random() * total) : 0;
            return accumulator;
          }, {})
        );
      } catch (error) {
        console.error('Error loading home frontpage:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFrontpage();
    return () => {
      active = false;
    };
  }, []);

  const suggestionCards = useMemo(() => {
    const groups = frontpage?.suggestion_groups || {};
    return SUGGESTION_ORDER.map((group) => {
      const items = groups[group.key]?.items || [];
      const currentIndex = indexes[group.key] || 0;
      const item = items[currentIndex] || null;
      return {
        ...group,
        item,
        path: groups[group.key]?.path || '/',
        total: items.length,
      };
    });
  }, [frontpage, indexes]);

  const handleReroll = (key, total) => {
    setIndexes((current) => ({
      ...current,
      [key]: nextIndexFor(current[key] || 0, total),
    }));
  };

  const nextActivity = frontpage?.next_activity;
  const consumables = frontpage?.consumables_due || [];
  const expenses = frontpage?.recent_expenses || [];
  const nextEvent = frontpage?.next_event;
  const activityLog = frontpage?.activity_log || [];

  return (
    <div className="page-container fade-in home-page">
      <section className="home-block home-block--daily glass-strong">
        <div className="home-block__header">
          <div>
            <span className="home-block__eyebrow">Daily</span>
            <h1>Próxima atividade</h1>
          </div>
          <Link to="/daily" className="home-block__link">Abrir daily</Link>
        </div>

        {nextActivity ? (
          <Link to={nextActivity.path} className="home-daily-link">
            <div className={`daily-block daily-block--${nextActivity.block_category || 'disciplina'} home-daily-block`}>
              <div className="daily-block__left">
                <div className="daily-block__meta">
                  <div className="daily-block__time">
                    {nextActivity.start_time} - {nextActivity.end_time || '--:--'}
                  </div>
                  <div className="daily-block__duration">{formatDuration(nextActivity.duration)}</div>
                </div>
              </div>
              <div className="daily-block__name">{nextActivity.title}</div>
              <div className="home-daily-block__pill">Agora</div>
            </div>
          </Link>
        ) : (
          <div className="home-empty-state">Nenhuma atividade pendente programada para hoje.</div>
        )}
      </section>

      <section className="home-suggestion-grid">
        {suggestionCards.map((group) => {
          const imageUrl = resolveMediaUrl(group.item?.image_path);
          const cardPath = group.item?.path || group.path;
          return (
            <article
              key={group.key}
              className={`home-suggestion-card home-suggestion-card--${group.key} ${group.item ? '' : 'is-empty'} glass-strong`}
            >
              <button
                type="button"
                className="home-suggestion-card__dice"
                onClick={() => handleReroll(group.key, group.total)}
                disabled={group.total <= 1}
                aria-label={`Sortear outra sugestão de ${group.label}`}
              >
                🎲
              </button>

              <Link to={cardPath} className="home-suggestion-card__surface">
                <div className="home-suggestion-card__media">
                  {imageUrl ? (
                    <img src={imageUrl} alt={group.item?.title || group.label} />
                  ) : (
                    <div className="home-suggestion-card__placeholder">{getPlaceholderLabel(group.label)}</div>
                  )}
                </div>
                <div className="home-suggestion-card__overlay" />
                <div className="home-suggestion-card__content">
                  <span className="home-suggestion-card__label">{group.item?.badge || group.label}</span>
                  <strong>{group.item?.title || group.label}</strong>
                  <p>{group.item?.description || group.empty}</p>
                  <small>{group.item?.meta || 'Abrir módulo'}</small>
                </div>
              </Link>
            </article>
          );
        })}
      </section>

      <section className="home-strip-grid">
        <article className="home-strip-card glass-strong">
          <div className="home-strip-card__header">
            <span className="home-strip-card__title"><Coins size={16} /> Consumíveis</span>
            <Link to="/shopping/consumiveis" className="home-strip-card__link">Ver</Link>
          </div>
          <div className="home-strip-card__body">
            {consumables.length === 0 ? <p className="home-strip-card__empty">Nada previsto para os próximos 3 dias.</p> : null}
            {consumables.map((item) => (
              <Link key={item.id} to={item.path} className="home-strip-line">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
                <div className="home-strip-line__meta">
                  <em>{item.status}</em>
                  <span>{item.date_label}</span>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="home-strip-card glass-strong">
          <div className="home-strip-card__header">
            <span className="home-strip-card__title"><ReceiptText size={16} /> Últimos gastos</span>
            <Link to="/financeiro" className="home-strip-card__link">Ver</Link>
          </div>
          <div className="home-strip-card__body">
            {expenses.length === 0 ? <p className="home-strip-card__empty">Nenhum gasto recente.</p> : null}
            {expenses.map((item) => (
              <Link key={item.id} to={item.path} className="home-strip-line">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
                <div className="home-strip-line__meta">
                  <em>{item.amount}</em>
                  <span>{item.occurred_at}</span>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="home-strip-card glass-strong">
          <div className="home-strip-card__header">
            <span className="home-strip-card__title"><CalendarClock size={16} /> Próximo evento</span>
            <Link to="/calendario" className="home-strip-card__link">Ver</Link>
          </div>
          <div className="home-strip-card__body home-strip-card__body--event">
            {nextEvent ? (
              <Link to={nextEvent.path} className="home-event-card">
                <strong>{nextEvent.title}</strong>
                <span>{nextEvent.description}</span>
                <div>
                  <em>{nextEvent.date_label}</em>
                  <em>{nextEvent.schedule}</em>
                </div>
              </Link>
            ) : (
              <p className="home-strip-card__empty">Nenhum evento futuro cadastrado.</p>
            )}
          </div>
        </article>
      </section>

      <section className="home-block home-block--log glass-strong">
        <div className="home-block__header">
          <div>
            <span className="home-block__eyebrow">Log</span>
            <h2>Movimento recente</h2>
          </div>
          <Link to="/calendario" className="home-block__link">Timeline</Link>
        </div>

        <div className="home-log-list">
          {activityLog.length === 0 ? <p className="home-strip-card__empty">Ainda não há registros recentes.</p> : null}
          {activityLog.map((entry) => (
            <Link key={entry.id} to={entry.path} className={`home-log-entry home-log-entry--${entry.category}`}>
              <span className="home-log-entry__text">{entry.text}</span>
              <time>{entry.timestamp}</time>
            </Link>
          ))}
        </div>
      </section>

      {loading ? <p className="home-loading"><ScrollText size={16} /> Montando a home...</p> : null}
    </div>
  );
};

export default Dashboard;

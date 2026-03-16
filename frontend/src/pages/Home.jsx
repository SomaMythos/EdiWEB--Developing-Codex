import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Coins, ReceiptText, ScrollText } from 'lucide-react';
import { dashboardApi } from '../services/api';
import '../components/daily/DailyTimeline.css';
import './Dashboard.css';
import NextActivity from '../components/dashboard/NextActivity';
import DashboardCards from '../components/dashboard/DashboardCards';

const SUGGESTION_ORDER = [
  { key: 'goal', label: 'Meta', empty: 'Nenhuma meta ativa agora.' },
  { key: 'reading', label: 'Leitura', empty: 'Nenhuma leitura em aberto.' },
  { key: 'music', label: 'Música', empty: 'Nada pendente em música.' },
  { key: 'watch', label: 'Assistir', empty: 'Nada pendente para assistir.' },
];

const nextIndexFor = (currentIndex, total) => {
  if (!total || total === 1) return 0;
  let candidate = currentIndex;
  while (candidate === currentIndex) {
    candidate = Math.floor(Math.random() * total);
  }
  return candidate;
};

const formatDuration = (minutes) => {
  const total = Number(minutes || 0);
  if (!total) return '0 MIN';
  if (total < 60) return `${total} MIN`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours}H ${remainder}MIN` : `${hours}H`;
};

const getPlaceholderLabel = (label) => label.slice(0, 1).toUpperCase();

const Home = () => {
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
      <NextActivity nextActivity={nextActivity} formatDuration={formatDuration} />

      <DashboardCards
        suggestionCards={suggestionCards}
        handleReroll={handleReroll}
        getPlaceholderLabel={getPlaceholderLabel}
      />

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

      <section className="home-block home-block--log page-shell">
        <div className="home-block__header">
          <div>
            <span className="home-block__eyebrow">Log</span>
            <h2>Movimento recente</h2>
          </div>
          <Link to="/calendario" className="home-block__link">Timeline</Link>
        </div>

        <div className="home-log-list glass-scrollbar">
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

export default Home;

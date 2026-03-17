import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { calendarApi } from '../services/api';
import './Calendario.css';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const toIsoDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value) => new Date(`${value}T12:00:00`);
const toMonthKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
const capitalize = (label) => label.charAt(0).toUpperCase() + label.slice(1);

const formatMonthLabel = (value) => capitalize(
  value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
);

const formatDayLabel = (value) => capitalize(
  parseIsoDate(value).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
);

const formatWeekLabel = (start, end) => {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startLabel = startDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: sameMonth ? undefined : 'short',
  });
  const endLabel = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${startLabel} - ${endLabel}`;
};

const buildMonthGrid = (value) => {
  const start = new Date(value.getFullYear(), value.getMonth(), 1);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
  const days = [];

  for (let index = 0; index < start.getDay(); index += 1) days.push(null);
  for (let day = 1; day <= end.getDate(); day += 1) days.push(new Date(value.getFullYear(), value.getMonth(), day));
  while (days.length % 7 !== 0) days.push(null);

  return days;
};

const formatTimeRange = (entry) => {
  if (entry.start_time && entry.end_time) return `${entry.start_time} - ${entry.end_time}`;
  if (entry.start_time) return entry.start_time;
  return 'Dia inteiro';
};

const sortEntriesByTime = (items) => [...items].sort((left, right) => {
  const leftTime = left.sortTime || '99:99';
  const rightTime = right.sortTime || '99:99';
  return leftTime.localeCompare(rightTime) || left.title.localeCompare(right.title);
});

const getDailyProgress = (summary = {}) => {
  const total = Number(summary.daily_blocks || 0);
  const completed = Number(summary.daily_completed_blocks || 0);
  const pending = Number(summary.daily_pending_blocks || Math.max(total - completed, 0));
  const allCompleted = Boolean(summary.daily_all_completed);
  return { total, completed, pending, allCompleted };
};

export default function Calendario() {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(today), [today]);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthData, setMonthData] = useState({ days: {} });
  const [weekData, setWeekData] = useState({ week_start: todayIso, week_end: todayIso, days: [] });
  const [dayData, setDayData] = useState({
    events: [],
    manual_logs: [],
    automatic_logs: [],
    daily_blocks: [],
    goal_deadlines: [],
    summary: {},
  });
  const [eventForm, setEventForm] = useState({
    date: todayIso,
    title: '',
    description: '',
    start_time: '',
    end_time: '',
  });
  const [logForm, setLogForm] = useState({ date: todayIso, title: '', description: '' });
  const [composerMode, setComposerMode] = useState('event');
  const [showComposerModal, setShowComposerModal] = useState(false);
  const [error, setError] = useState('');
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const monthKey = toMonthKey(currentMonth);
  const monthGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const loadMonth = async (month) => {
    setLoadingMonth(true);
    try {
      const response = await calendarApi.getMonth(month);
      setMonthData(response.data.data || { days: {} });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Falha ao carregar o mês.');
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadWeek = async (date) => {
    setLoadingWeek(true);
    try {
      const response = await calendarApi.getWeek(date);
      setWeekData(response.data.data || { week_start: date, week_end: date, days: [] });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Falha ao carregar a semana.');
    } finally {
      setLoadingWeek(false);
    }
  };

  const loadDay = async (date) => {
    setLoadingDay(true);
    try {
      const response = await calendarApi.getDay(date);
      setDayData(response.data.data || {
        events: [],
        manual_logs: [],
        automatic_logs: [],
        daily_blocks: [],
        goal_deadlines: [],
        summary: {},
      });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Falha ao carregar o dia selecionado.');
    } finally {
      setLoadingDay(false);
    }
  };

  useEffect(() => {
    loadMonth(monthKey);
  }, [monthKey]);

  useEffect(() => {
    loadWeek(selectedDate);
    loadDay(selectedDate);
    setEventForm((current) => ({ ...current, date: selectedDate }));
    setLogForm((current) => ({ ...current, date: selectedDate }));

    const selected = parseIsoDate(selectedDate);
    if (selected.getMonth() !== currentMonth.getMonth() || selected.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [selectedDate]);

  const refreshCalendar = async (date = selectedDate) => {
    const month = toMonthKey(parseIsoDate(date));
    await Promise.all([loadWeek(date), loadDay(date), loadMonth(month)]);
  };

  const closeComposerModal = () => setShowComposerModal(false);

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await calendarApi.createEvent(eventForm);
      setEventForm((current) => ({
        ...current,
        title: '',
        description: '',
        start_time: '',
        end_time: '',
      }));
      await refreshCalendar(eventForm.date);
      closeComposerModal();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível salvar o evento.');
    }
  };

  const handleCreateManualLog = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await calendarApi.createManualLog(logForm);
      setLogForm((current) => ({ ...current, title: '', description: '' }));
      await refreshCalendar(logForm.date);
      closeComposerModal();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível salvar o registro manual.');
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      setError('');
      await calendarApi.deleteEvent(id);
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível excluir o evento.');
    }
  };

  const handleToggleEventCompletion = async (id, completed) => {
    try {
      setError('');
      await calendarApi.completeEvent(id, completed);
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível atualizar o evento.');
    }
  };

  const handleDeleteManualLog = async (id) => {
    try {
      setError('');
      await calendarApi.deleteManualLog(id);
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível excluir o registro manual.');
    }
  };

  const weekCards = weekData.days || [];

  const agendaItems = useMemo(() => sortEntriesByTime([
    ...(dayData.events || []).map((event) => ({
      id: `event-${event.id}`,
      sourceId: event.id,
      kind: 'event',
      title: event.title,
      meta: event.is_completed ? 'Concluído' : (event.description || 'Evento manual'),
      time: formatTimeRange(event),
      sortTime: event.start_time || '99:99',
      removable: true,
      completed: Boolean(event.is_completed),
    })),
    ...(dayData.daily_blocks || []).map((block) => ({
      id: `daily-${block.id}`,
      kind: 'daily',
      title: block.title,
      meta: block.completed ? 'Concluído' : `${block.duration} min`,
      time: block.start_time ? `${block.start_time}${block.end_time ? ` - ${block.end_time}` : ''}` : 'Sem horário',
      sortTime: block.start_time || '99:99',
      removable: false,
    })),
    ...(dayData.goal_deadlines || []).map((goal) => ({
      id: `goal-${goal.id}`,
      kind: 'goal',
      title: goal.title,
      meta: goal.goal_mode === 'milestones' ? 'Meta por etapas' : 'Meta simples',
      time: goal.deadline_time || 'Prazo do dia',
      sortTime: goal.deadline_time || '99:99',
      removable: false,
    })),
  ]), [dayData]);

  const logItems = useMemo(() => {
    const manualLogs = (dayData.manual_logs || []).map((entry) => ({
      id: `manual-${entry.id}`,
      sourceId: entry.id,
      kind: 'manual',
      title: entry.title,
      description: entry.description || 'Registro manual',
      stamp: entry.created_at || '',
      removable: true,
    }));

    const automaticLogs = (dayData.automatic_logs || []).map((entry) => ({
      id: `auto-${entry.id}`,
      kind: entry.source_module || 'sistema',
      title: entry.title,
      description: entry.description,
      stamp: entry.timestamp || '',
      removable: false,
    }));

    return [...manualLogs, ...automaticLogs].sort((left, right) => (right.stamp || '').localeCompare(left.stamp || ''));
  }, [dayData]);

  const currentWeekLabel = formatWeekLabel(weekData.week_start || selectedDate, weekData.week_end || selectedDate);

  return (
    <div className="page-container fade-in calendar-page">
      <header className="calendar-header">
        <h1>Calendário</h1>
        <div className="calendar-nav">
          <button
            type="button"
            className="btn btn-secondary btn-icon btn-icon-md"
            onClick={() => setSelectedDate(toIsoDate(new Date(parseIsoDate(selectedDate).getTime() - (7 * 24 * 60 * 60 * 1000))))}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="calendar-nav-label">
            <span>Semana</span>
            <strong>{currentWeekLabel}</strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon btn-icon-md"
            onClick={() => setSelectedDate(toIsoDate(new Date(parseIsoDate(selectedDate).getTime() + (7 * 24 * 60 * 60 * 1000))))}
            aria-label="Próxima semana"
          >
            <ChevronRight size={18} />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setSelectedDate(todayIso)}>
            Hoje
          </button>
        </div>
      </header>

      {error ? <div className="calendar-alert">{error}</div> : null}

      <section className="calendar-week-shell page-shell">
        <div className="calendar-week-topline">
          <div>
            <span className="calendar-kicker">Semana</span>
            <strong>{currentWeekLabel}</strong>
          </div>
          {loadingWeek ? <span className="calendar-loading-inline">Atualizando...</span> : null}
        </div>

        <div className="calendar-week-grid">
          {weekCards.map((day) => {
            const dayDate = parseIsoDate(day.date);
            const dailyProgress = getDailyProgress(day.summary);
            return (
              <button
                type="button"
                key={day.date}
                className={[
                  'calendar-week-card',
                  'elevation-1',
                  selectedDate === day.date ? 'is-selected' : '',
                  dailyProgress.allCompleted ? 'is-daily-complete' : '',
                  day.is_today ? 'is-today' : '',
                ].join(' ')}
                onClick={() => setSelectedDate(day.date)}
              >
                <div className="calendar-week-card-head">
                  <span>{WEEK_DAYS[dayDate.getDay()]}</span>
                  <strong>{String(day.day_number).padStart(2, '0')}</strong>
                </div>

                <div className="calendar-week-card-metrics">
                  {day.summary.manual_events ? <span className="calendar-dot is-event">{day.summary.manual_events} evento</span> : null}
                  {dailyProgress.total ? <span className="calendar-dot is-daily">{dailyProgress.completed}/{dailyProgress.total} daily</span> : null}
                  {day.summary.goal_deadlines ? <span className="calendar-dot is-goal">{day.summary.goal_deadlines} meta</span> : null}
                </div>

                {dailyProgress.total ? (
                  <div className={`calendar-daily-progress ${dailyProgress.allCompleted ? 'is-complete' : ''}`.trim()}>
                    <strong>{dailyProgress.allCompleted ? '100% concluído' : `${dailyProgress.completed}/${dailyProgress.total} atividades concluídas`}</strong>
                    <span>{dailyProgress.allCompleted ? 'Daily finalizada' : `${dailyProgress.pending} pendente(s)`}</span>
                  </div>
                ) : null}

                <div className="calendar-week-preview">
                  {day.preview.length ? day.preview.map((entry) => (
                    <div key={`${day.date}-${entry.kind}-${entry.title}`} className={`calendar-preview-line is-${entry.kind}`}>
                      <span>{entry.time || 'Sem hora'}</span>
                      <strong>{entry.title}</strong>
                    </div>
                  )) : (!dailyProgress.total ? <span className="calendar-empty-inline">Livre</span> : null)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="calendar-content-grid">
        <article className="calendar-day-shell page-shell">
          <div className="calendar-day-head">
            <div>
              <span className="calendar-kicker">Dia</span>
              <h2>{formatDayLabel(selectedDate)}</h2>
            </div>
            <div className="calendar-day-actions">
              {loadingDay ? <span className="calendar-loading-inline">Atualizando...</span> : null}
              <button type="button" className="btn btn-primary" onClick={() => setShowComposerModal(true)}>
                <Plus size={16} /> Adicionar
              </button>
            </div>
          </div>

          <div className="calendar-day-sections">
            <section className="calendar-panel elevation-1">
              <div className="calendar-panel-head">
                <h3><CalendarDays size={16} /> Agenda</h3>
              </div>
              <div className="calendar-panel-body">
                {agendaItems.length ? agendaItems.map((entry) => (
                  <div key={entry.id} className={`calendar-entry is-${entry.kind} ${entry.completed ? 'is-completed' : ''}`.trim()}>
                    <div className="calendar-entry-main">
                      <span className="calendar-entry-time">{entry.time}</span>
                      <strong>{entry.title}</strong>
                      <p>{entry.meta}</p>
                    </div>
                    {entry.removable ? (
                      <div className="calendar-entry-actions">
                        <button
                          type="button"
                          className={`calendar-icon-button calendar-complete-button ${entry.completed ? 'is-completed' : ''}`.trim()}
                          onClick={() => handleToggleEventCompletion(entry.sourceId, !entry.completed)}
                          aria-label={entry.completed ? 'Reabrir evento' : 'Concluir evento'}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          className="calendar-icon-button"
                          onClick={() => handleDeleteEvent(entry.sourceId)}
                          aria-label="Excluir evento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )) : <p className="calendar-empty-block">Nada programado para este dia.</p>}
              </div>
            </section>

            <section className="calendar-panel elevation-1">
              <div className="calendar-panel-head">
                <h3><Sparkles size={16} /> Registros</h3>
              </div>
              <div className="calendar-panel-body glass-scrollbar calendar-log-list">
                {logItems.length ? logItems.map((entry) => (
                  <div key={entry.id} className={`calendar-log-entry is-${entry.kind}`}>
                    <div className="calendar-log-copy">
                      <strong>{entry.title}</strong>
                      <p>{entry.description}</p>
                    </div>
                    <div className="calendar-log-meta">
                      {entry.removable ? (
                        <button
                          type="button"
                          className="calendar-icon-button"
                          onClick={() => handleDeleteManualLog(entry.sourceId)}
                          aria-label="Excluir registro manual"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )) : <p className="calendar-empty-block">Nada registrado neste dia.</p>}
              </div>
            </section>
          </div>
        </article>

        <aside className="calendar-side-stack">
          <section className="page-shell calendar-mini-month">
            <div className="calendar-mini-head">
              <button
                type="button"
                className="btn btn-secondary btn-icon btn-icon-sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{formatMonthLabel(currentMonth)}</strong>
              <button
                type="button"
                className="btn btn-secondary btn-icon btn-icon-sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="calendar-mini-weekdays">
              {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
            </div>

            <div className="calendar-mini-grid">
              {monthGrid.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="calendar-mini-cell is-empty" aria-hidden="true" />;
                }

                const isoDay = toIsoDate(day);
                const summary = monthData.days?.[isoDay] || {};
                const dailyProgress = getDailyProgress(summary);
                return (
                  <button
                    type="button"
                    key={isoDay}
                    className={[
                      'calendar-mini-cell',
                      selectedDate === isoDay ? 'is-selected' : '',
                      dailyProgress.allCompleted ? 'is-daily-complete' : '',
                      isoDay === todayIso ? 'is-today' : '',
                    ].join(' ')}
                    onClick={() => setSelectedDate(isoDay)}
                  >
                    <span>{day.getDate()}</span>
                    {dailyProgress.allCompleted ? <em className="calendar-mini-progress">100%</em> : null}
                    <div className="calendar-mini-dots">
                      {summary.manual_events ? <i className="is-event" /> : null}
                      {summary.daily_blocks ? <i className="is-daily" /> : null}
                      {summary.goal_deadlines ? <i className="is-goal" /> : null}
                      {summary.automatic_logs ? <i className="is-log" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
            {loadingMonth ? <span className="calendar-loading-inline">Atualizando...</span> : null}
          </section>
        </aside>
      </section>

      {showComposerModal ? (
        <div className="modal-overlay" onClick={closeComposerModal}>
          <div className="modal-content calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-modal-head">
              <div>
                <span className="calendar-kicker">Adicionar</span>
                <h3>{composerMode === 'event' ? 'Novo evento' : 'Novo registro'}</h3>
              </div>
              <button type="button" className="calendar-icon-button" onClick={closeComposerModal} aria-label="Fechar modal">
                <X size={16} />
              </button>
            </div>

            <div className="calendar-segmented">
              <button
                type="button"
                className={composerMode === 'event' ? 'is-active' : ''}
                onClick={() => setComposerMode('event')}
              >
                Evento
              </button>
              <button
                type="button"
                className={composerMode === 'log' ? 'is-active' : ''}
                onClick={() => setComposerMode('log')}
              >
                Log
              </button>
            </div>

            {composerMode === 'event' ? (
              <form className="calendar-form" onSubmit={handleCreateEvent}>
                <label>
                  Dia
                  <input type="date" value={eventForm.date} onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))} required />
                </label>
                <label>
                  Título
                  <input type="text" value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} required />
                </label>
                <label>
                  Descrição
                  <textarea value={eventForm.description} onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
                </label>
                <div className="calendar-form-inline">
                  <label>
                    <Clock3 size={14} /> Início
                    <input type="time" value={eventForm.start_time} onChange={(event) => setEventForm((current) => ({ ...current, start_time: event.target.value }))} />
                  </label>
                  <label>
                    <Clock3 size={14} /> Fim
                    <input type="time" value={eventForm.end_time} onChange={(event) => setEventForm((current) => ({ ...current, end_time: event.target.value }))} />
                  </label>
                </div>
                <div className="calendar-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={closeComposerModal}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit">
                    <Plus size={16} /> Salvar evento
                  </button>
                </div>
              </form>
            ) : (
              <form className="calendar-form" onSubmit={handleCreateManualLog}>
                <label>
                  Dia
                  <input type="date" value={logForm.date} onChange={(event) => setLogForm((current) => ({ ...current, date: event.target.value }))} required />
                </label>
                <label>
                  Título
                  <input type="text" value={logForm.title} onChange={(event) => setLogForm((current) => ({ ...current, title: event.target.value }))} required />
                </label>
                <label>
                  Registro
                  <textarea value={logForm.description} onChange={(event) => setLogForm((current) => ({ ...current, description: event.target.value }))} rows={5} />
                </label>
                <div className="calendar-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={closeComposerModal}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit">
                    <NotebookPen size={16} /> Salvar registro
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

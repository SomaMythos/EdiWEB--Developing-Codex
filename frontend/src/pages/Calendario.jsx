import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Flag, NotebookPen, Sparkles, Trash2 } from 'lucide-react';
import { calendarApi } from '../services/api';
import './Calendario.css';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const toIsoDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toMonthKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const capitalize = (label) => label.charAt(0).toUpperCase() + label.slice(1);

const monthLabel = (value) => capitalize(value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

const dayLabel = (value) => capitalize(new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
}));

const normalizeMonthGrid = (value) => {
  const start = new Date(value.getFullYear(), value.getMonth(), 1);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
  const days = [];

  for (let index = 0; index < start.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    days.push(new Date(value.getFullYear(), value.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
};

const formatTimeRange = (entry) => {
  if (entry.start_time && entry.end_time) return `${entry.start_time} - ${entry.end_time}`;
  if (entry.start_time) return entry.start_time;
  return 'Dia inteiro';
};

const Calendario = () => {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toIsoDate(today));
  const [monthData, setMonthData] = useState({ days: {}, manual_events: [], manual_logs: [] });
  const [dayData, setDayData] = useState({ events: [], manual_logs: [], automatic_logs: [], summary: {} });
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [eventForm, setEventForm] = useState({ date: toIsoDate(today), title: '', description: '', start_time: '', end_time: '' });
  const [logForm, setLogForm] = useState({ date: toIsoDate(today), title: '', description: '' });
  const [error, setError] = useState('');

  const monthKey = toMonthKey(currentMonth);
  const monthEvents = monthData.manual_events || [];
  const gridDays = useMemo(() => normalizeMonthGrid(currentMonth), [currentMonth]);

  const loadMonth = async () => {
    setIsLoadingMonth(true);
    try {
      const response = await calendarApi.getMonth(monthKey);
      setMonthData(response.data.data || { days: {}, manual_events: [], manual_logs: [] });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Falha ao carregar o calendário do mês.');
    } finally {
      setIsLoadingMonth(false);
    }
  };

  const loadDay = async (date) => {
    setIsLoadingDay(true);
    try {
      const response = await calendarApi.getDay(date);
      setDayData(response.data.data || { events: [], manual_logs: [], automatic_logs: [], summary: {} });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Falha ao carregar o dia selecionado.');
    } finally {
      setIsLoadingDay(false);
    }
  };

  useEffect(() => {
    loadMonth();
  }, [monthKey]);

  useEffect(() => {
    loadDay(selectedDate);
    setEventForm((current) => ({ ...current, date: selectedDate }));
    setLogForm((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  const refreshCalendar = async (date = selectedDate) => {
    await Promise.all([loadMonth(), loadDay(date)]);
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await calendarApi.createEvent(eventForm);
      setEventForm((current) => ({ ...current, title: '', description: '', start_time: '', end_time: '' }));
      await refreshCalendar(eventForm.date);
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

  const handleDeleteManualLog = async (id) => {
    try {
      setError('');
      await calendarApi.deleteManualLog(id);
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível excluir o log manual.');
    }
  };

  const selectedDaySummary = dayData.summary || {};

  return (
    <div className="page-container fade-in calendar-page">
      <header className="calendar-header">
        <div>
          <h1>Calendário</h1>
          <p>Agenda manual, registros livres e timeline automática do que você concluiu no EDI.</p>
        </div>
        <div className="calendar-month-switcher">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>{monthLabel(currentMonth)}</strong>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {error ? <div className="calendar-alert">{error}</div> : null}

      <section className="calendar-layout">
        <article className="calendar-board card">
          <div className="calendar-weekdays">
            {WEEK_DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {gridDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="calendar-cell calendar-cell-empty" aria-hidden="true" />;
              }

              const isoDay = toIsoDate(day);
              const summary = monthData.days?.[isoDay] || {};
              const isSelected = selectedDate === isoDay;
              const isToday = isoDay === toIsoDate(today);
              const hasManualEvent = Boolean(summary.has_manual_event);

              return (
                <button
                  type="button"
                  key={isoDay}
                  className={`calendar-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${hasManualEvent ? 'has-manual-event' : ''}`.trim()}
                  onClick={() => setSelectedDate(isoDay)}
                >
                  <span className="calendar-day-number">{day.getDate()}</span>
                  <div className="calendar-cell-metrics">
                    {summary.manual_events ? <span className="metric-pill metric-manual">{summary.manual_events} evento(s)</span> : null}
                    {summary.manual_logs ? <span className="metric-pill metric-log">{summary.manual_logs} log(s)</span> : null}
                    {summary.automatic_logs ? <span className="metric-pill metric-auto">{summary.automatic_logs} auto</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          {isLoadingMonth ? <p className="calendar-loading">Carregando o mês...</p> : null}
        </article>

        <aside className="calendar-legend card">
          <div className="calendar-legend-header">
            <h2>Legendas do mês</h2>
            <p>Eventos cadastrados manualmente aparecem aqui e destacam os dias no calendário.</p>
          </div>
          <div className="calendar-legend-list">
            {monthEvents.length === 0 ? <p className="calendar-empty">Nenhum evento manual neste mês.</p> : null}
            {monthEvents.map((event) => (
              <div key={event.id} className="legend-item">
                <div>
                  <strong>{event.title}</strong>
                  <p>
                    {new Date(`${event.date}T12:00:00`).toLocaleDateString('pt-BR')}
                    {event.start_time ? ` • ${formatTimeRange(event)}` : ''}
                  </p>
                  {event.description ? <span>{event.description}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="calendar-details-layout">
        <article className="card calendar-day-panel">
          <div className="calendar-day-panel-header">
            <div>
              <h2>{dayLabel(selectedDate)}</h2>
              <p>
                {selectedDaySummary.manual_events || 0} evento(s) • {selectedDaySummary.manual_logs || 0} log(s) manual(is) • {selectedDaySummary.automatic_logs || 0} registro(s) automático(s)
              </p>
            </div>
          </div>

          {isLoadingDay ? <p className="calendar-loading">Carregando registros do dia...</p> : null}

          <div className="calendar-day-columns">
            <div className="calendar-entry-group">
              <h3><Flag size={16} /> Eventos do dia</h3>
              {dayData.events.length ? dayData.events.map((event) => (
                <div key={event.id} className="calendar-entry-card">
                  <div>
                    <strong>{event.title}</strong>
                    <p>{formatTimeRange(event)}</p>
                    {event.description ? <span>{event.description}</span> : null}
                  </div>
                  <button type="button" className="icon-only danger" onClick={() => handleDeleteEvent(event.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : <p className="calendar-empty">Nenhum evento manual para este dia.</p>}
            </div>

            <div className="calendar-entry-group">
              <h3><NotebookPen size={16} /> Logs manuais</h3>
              {dayData.manual_logs.length ? dayData.manual_logs.map((log) => (
                <div key={log.id} className="calendar-entry-card">
                  <div>
                    <strong>{log.title}</strong>
                    {log.description ? <span>{log.description}</span> : <p>Sem descrição.</p>}
                  </div>
                  <button type="button" className="icon-only danger" onClick={() => handleDeleteManualLog(log.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : <p className="calendar-empty">Nenhum log manual neste dia.</p>}
            </div>
          </div>

          <div className="calendar-entry-group calendar-entry-group-full">
            <h3><Sparkles size={16} /> Timeline automática do EDI</h3>
            {dayData.automatic_logs.length ? dayData.automatic_logs.map((entry) => (
              <div key={entry.id} className="calendar-entry-card automatic-card">
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.description}</p>
                </div>
                <span className="automatic-badge">{entry.source_module}</span>
              </div>
            )) : <p className="calendar-empty">Nada registrado automaticamente neste dia.</p>}
          </div>
        </article>

        <aside className="calendar-forms-stack">
          <form className="card calendar-form-card" onSubmit={handleCreateEvent}>
            <h2>Novo evento</h2>
            <label>
              Dia
              <input type="date" value={eventForm.date} onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))} required />
            </label>
            <label>
              Título
              <input type="text" value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: consulta, compromisso, entrega" required />
            </label>
            <label>
              Descrição
              <textarea value={eventForm.description} onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Detalhes do evento" />
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
            <button className="btn btn-primary" type="submit">Salvar evento</button>
          </form>

          <form className="card calendar-form-card" onSubmit={handleCreateManualLog}>
            <h2>Novo log manual</h2>
            <label>
              Dia
              <input type="date" value={logForm.date} onChange={(event) => setLogForm((current) => ({ ...current, date: event.target.value }))} required />
            </label>
            <label>
              Título
              <input type="text" value={logForm.title} onChange={(event) => setLogForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: o que eu fiz hoje" required />
            </label>
            <label>
              Descrição
              <textarea value={logForm.description} onChange={(event) => setLogForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Resumo livre do dia" />
            </label>
            <button className="btn btn-secondary" type="submit">Adicionar log manual</button>
          </form>
        </aside>
      </section>
    </div>
  );
};

export default Calendario;

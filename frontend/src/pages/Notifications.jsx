import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Clock3, Plus, Send, Sparkles } from 'lucide-react';
import { notificationsApi } from '../services/api';
import {
  buildNotificationMeta,
  formatNotificationTimestamp,
  getNotificationOpenLabel,
  getNotificationRoute,
  getNotificationSeverity,
  getNotificationSnoozeMinutes,
  normalizeNotification,
} from '../utils/notificationHelpers';
import './Reminders.css';

const MAX_MESSAGE_LENGTH = 500;
const INITIAL_FORM = {
  title: '',
  message: '',
  scheduled_for: '',
  severity: 'info',
  sound_key: '',
  color_token: '',
};
const PUSH_FILTERS = ['all', 'sent', 'failed', 'receipt_ok', 'receipt_error', 'dry_run'];
const INBOX_FILTERS = ['all', 'critical', 'warning', 'info', 'success', 'neutral'];
const VIEW_MODES = ['inbox', 'compose', 'push'];

const sortInbox = (items) => {
  const severityRank = { critical: 0, warning: 1, info: 2, success: 3, neutral: 4 };
  return [...items].sort((left, right) => {
    const dueLeft = left.is_due === false ? 1 : 0;
    const dueRight = right.is_due === false ? 1 : 0;
    if (dueLeft !== dueRight) return dueLeft - dueRight;
    if (left.status !== right.status) return left.status === 'unread' ? -1 : 1;
    const severityDiff = (severityRank[left.severity] ?? 10) - (severityRank[right.severity] ?? 10);
    if (severityDiff !== 0) return severityDiff;
    return String(right.scheduled_for || right.created_at || '').localeCompare(String(left.scheduled_for || left.created_at || ''));
  });
};

const isCustomNotification = (notification) => (
  (notification.notification_type || notification.type) === 'custom_notification'
  && notification.source_feature === 'custom'
);

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('inbox');
  const [notifications, setNotifications] = useState([]);
  const [devices, setDevices] = useState([]);
  const [pushDeliveries, setPushDeliveries] = useState([]);
  const [pushStatusFilter, setPushStatusFilter] = useState('all');
  const [inboxFilter, setInboxFilter] = useState('all');
  const [showOnlyUnread, setShowOnlyUnread] = useState(true);
  const [showFuture, setShowFuture] = useState(false);
  const [pushActionState, setPushActionState] = useState({ loading: false, message: '', error: '' });
  const [pageState, setPageState] = useState({ loading: true, error: '' });
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadData = async () => {
    setPageState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const deliveryParams = pushStatusFilter === 'all' ? { limit: 20 } : { limit: 20, status: pushStatusFilter };
      const [notificationsResponse, devicesResponse, deliveriesResponse] = await Promise.all([
        notificationsApi.list({ include_read: true, include_generated: true }),
        notificationsApi.listDevices(),
        notificationsApi.listPushDeliveries(deliveryParams),
      ]);

      setNotifications(sortInbox((notificationsResponse.data.data || []).map(normalizeNotification)));
      setDevices(devicesResponse.data.data || []);
      setPushDeliveries(deliveriesResponse.data.data || []);
      setPageState({ loading: false, error: '' });
    } catch (error) {
      setPageState({
        loading: false,
        error: error?.response?.data?.detail || 'Falha ao carregar notificações.',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [pushStatusFilter]);

  const validateForm = () => {
    if (!form.title.trim()) return 'Título é obrigatório.';
    if (form.scheduled_for) {
      const parsedDate = new Date(form.scheduled_for);
      if (Number.isNaN(parsedDate.getTime())) return 'Data e hora inválidas.';
    }
    if ((form.message || '').trim().length > MAX_MESSAGE_LENGTH) {
      return `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`;
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    const payload = {
      title: form.title.trim(),
      message: form.message.trim() || null,
      scheduled_for: form.scheduled_for || null,
      severity: form.severity,
      sound_key: form.sound_key || null,
      color_token: form.color_token || null,
    };

    if (editingId) {
      await notificationsApi.updateCustom(editingId, payload);
      setEditingId(null);
    } else {
      await notificationsApi.createCustom(payload);
    }

    setForm(INITIAL_FORM);
    setViewMode('inbox');
    await loadData();
  };

  const startEditing = (notification) => {
    setEditingId(notification.id);
    setViewMode('compose');
    setForm({
      title: notification.title || '',
      message: notification.message || '',
      scheduled_for: notification.scheduled_for ? notification.scheduled_for.slice(0, 16) : '',
      severity: notification.severity || 'info',
      sound_key: notification.sound_key || '',
      color_token: notification.color_token || '',
    });
    setFormError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError('');
  };

  const runPushAction = async (fn, successMessage) => {
    setPushActionState({ loading: true, message: '', error: '' });
    try {
      const response = await fn();
      const payload = response?.data?.data;
      const details = payload ? ` ${JSON.stringify(payload)}` : '';
      setPushActionState({ loading: false, message: `${successMessage}.${details}`, error: '' });
      await loadData();
    } catch (error) {
      setPushActionState({
        loading: false,
        message: '',
        error: error?.response?.data?.detail || 'Falha ao executar ação de push.',
      });
    }
  };

  const handleInboxAction = async (notification, action) => {
    setActionLoadingId(notification.id);
    try {
      if (action === 'open') {
        await notificationsApi.updateStatus(notification.id, 'read');
        navigate(getNotificationRoute(notification));
      } else if (action === 'read') {
        await notificationsApi.updateStatus(notification.id, 'read');
      } else if (action === 'complete') {
        await notificationsApi.updateStatus(notification.id, 'completed');
      } else if (action === 'snooze') {
        await notificationsApi.snooze(notification.id, getNotificationSnoozeMinutes(notification));
      }
      await loadData();
    } catch (error) {
      console.error('Error applying inbox action:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkAction = async (status) => {
    if (filteredNotifications.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(filteredNotifications.map((notification) => notificationsApi.updateStatus(notification.id, status)));
      await loadData();
    } catch (error) {
      console.error('Error applying bulk action:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeviceRemoval = async (deviceToken) => {
    await runPushAction(() => notificationsApi.deleteDevice(deviceToken), 'Device removido');
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (showOnlyUnread && notification.status !== 'unread') return false;
      if (!showFuture && notification.is_due === false) return false;
      if (inboxFilter !== 'all' && getNotificationSeverity(notification) !== inboxFilter) return false;
      return true;
    });
  }, [inboxFilter, notifications, showFuture, showOnlyUnread]);

  const summary = useMemo(() => ({
    unread: notifications.filter((item) => item.status === 'unread').length,
    critical: notifications.filter((item) => getNotificationSeverity(item) === 'critical' && item.status === 'unread').length,
    scheduled: notifications.filter((item) => item.scheduled_for && item.status === 'unread').length,
    devices: devices.length,
  }), [devices.length, notifications]);

  return (
    <div className="page-container fade-in notifications-page-shell">
      <section className="notifications-page-head page-shell">
        <div>
          <span className="notifications-head-kicker">Notificações</span>
          <h1>Inbox do sistema</h1>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadData}
          disabled={pageState.loading || pushActionState.loading}
        >
          {pageState.loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </section>

      <section className="notifications-mini-stats">
        <article className="notifications-mini-pill page-shell">
          <span>Unread</span>
          <strong>{summary.unread}</strong>
        </article>
        <article className="notifications-mini-pill page-shell is-critical">
          <span>Críticas</span>
          <strong>{summary.critical}</strong>
        </article>
        <article className="notifications-mini-pill page-shell">
          <span>Agendadas</span>
          <strong>{summary.scheduled}</strong>
        </article>
        <article className="notifications-mini-pill page-shell">
          <span>Devices</span>
          <strong>{summary.devices}</strong>
        </article>
      </section>

      <section className="notifications-mode-shell page-shell">
        <div className="notifications-mode-toggle">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={viewMode === mode ? 'active' : ''}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'inbox' ? 'Inbox' : mode === 'compose' ? 'Criar' : 'Push'}
            </button>
          ))}
        </div>

        {pageState.error ? <p className="form-error">{pageState.error}</p> : null}

        {viewMode === 'inbox' ? (
          <div className="notifications-focus-shell">
            <div className="notifications-inbox-toolbar">
              <div className="notifications-filter-row">
                {INBOX_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`notifications-filter-chip ${inboxFilter === filter ? 'active' : ''}`}
                    onClick={() => setInboxFilter(filter)}
                  >
                    {filter === 'all' ? 'Todas' : filter}
                  </button>
                ))}
              </div>

              <div className="notifications-inbox-actions">
                <label className="checkbox-row">
                  <input type="checkbox" checked={showOnlyUnread} onChange={(event) => setShowOnlyUnread(event.target.checked)} />
                  <span>Não lidas</span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={showFuture} onChange={(event) => setShowFuture(event.target.checked)} />
                  <span>Futuras</span>
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={bulkLoading || filteredNotifications.length === 0}
                  onClick={() => handleBulkAction('read')}
                >
                  Ler visíveis
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={bulkLoading || filteredNotifications.length === 0}
                  onClick={() => handleBulkAction('completed')}
                >
                  Concluir visíveis
                </button>
              </div>
            </div>

            <div className="notifications-inbox-stack">
              {filteredNotifications.length === 0 ? <p className="notifications-empty">Nada nesse filtro.</p> : null}
              {filteredNotifications.map((notification) => {
                const severity = getNotificationSeverity(notification);
                const details = buildNotificationMeta(notification);
                return (
                  <article key={notification.id} className={`notification-inbox-row severity-${severity}`}>
                    <div className="notification-inbox-copy">
                      <div className="notification-inbox-headline">
                        <strong>{notification.title || 'Notificação'}</strong>
                        <span>{formatNotificationTimestamp(notification.scheduled_for || notification.created_at)}</span>
                      </div>
                      {notification.message ? <p>{notification.message}</p> : null}
                      <div className="notification-inbox-meta">
                        <span>{notification.status}</span>
                        <span>{notification.is_due === false ? 'Agendada' : 'Agora'}</span>
                        {details.map((detail) => <span key={detail}>{detail}</span>)}
                      </div>
                    </div>

                    <div className="notification-inbox-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionLoadingId === notification.id}
                        onClick={() => handleInboxAction(notification, 'open')}
                      >
                        {getNotificationOpenLabel(notification)}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoadingId === notification.id}
                        onClick={() => handleInboxAction(notification, 'snooze')}
                      >
                        <Clock3 size={14} /> {getNotificationSnoozeMinutes(notification)}m
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoadingId === notification.id}
                        onClick={() => handleInboxAction(notification, 'read')}
                      >
                        Lida
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoadingId === notification.id}
                        onClick={() => handleInboxAction(notification, 'complete')}
                      >
                        Concluir
                      </button>
                      {isCustomNotification(notification) ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditing(notification)}>
                          Editar
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {viewMode === 'compose' ? (
          <div className="notifications-compose-shell">
            <form onSubmit={handleSubmit} className="notifications-compose-card page-shell">
              <div className="notifications-section-head">
                <h2><Plus size={18} /> {editingId ? 'Editar notificação' : 'Nova notificação'}</h2>
              </div>

              <div className="notifications-form-grid">
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Título"
                  required
                />
                <textarea
                  className="input"
                  value={form.message}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Mensagem"
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <input
                  type="datetime-local"
                  className="input"
                  value={form.scheduled_for}
                  onChange={(event) => setForm((current) => ({ ...current, scheduled_for: event.target.value }))}
                />
                <div className="notifications-compose-grid">
                  <select className="input" value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}>
                    <option value="info">Informativa</option>
                    <option value="success">Sucesso</option>
                    <option value="warning">Aviso</option>
                    <option value="critical">Crítica</option>
                    <option value="neutral">Neutra</option>
                  </select>
                  <select className="input" value={form.color_token} onChange={(event) => setForm((current) => ({ ...current, color_token: event.target.value }))}>
                    <option value="">Cor padrão</option>
                    <option value="primary">Primária</option>
                    <option value="accent">Destaque</option>
                    <option value="success">Sucesso</option>
                    <option value="warning">Aviso</option>
                    <option value="danger">Perigo</option>
                  </select>
                  <select className="input" value={form.sound_key} onChange={(event) => setForm((current) => ({ ...current, sound_key: event.target.value }))}>
                    <option value="">Sem som</option>
                    <option value="default">Padrão</option>
                    <option value="soft_chime">Toque suave</option>
                    <option value="urgent_ping">Toque urgente</option>
                  </select>
                </div>
                {formError ? <p className="form-error">{formError}</p> : null}
                <div className="notifications-compose-actions">
                  {editingId ? (
                    <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
                      Cancelar
                    </button>
                  ) : null}
                  <button className="btn btn-primary">{editingId ? 'Salvar edição' : 'Criar notificação'}</button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {viewMode === 'push' ? (
          <div className="notifications-push-shell">
            <section className="page-shell notifications-push-card">
              <div className="notifications-section-head">
                <h2><Send size={18} /> Operação de push</h2>
                <select className="input notifications-push-filter" value={pushStatusFilter} onChange={(event) => setPushStatusFilter(event.target.value)}>
                  {PUSH_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'Todos os receipts' : status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="notifications-push-actions">
                <button type="button" className="btn btn-secondary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: true }), 'Dry run executado')}>
                  Dry run
                </button>
                <button type="button" className="btn btn-primary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: false }), 'Dispatch executado')}>
                  Disparar push
                </button>
                <button type="button" className="btn btn-secondary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.refreshPushReceipts({}), 'Receipts atualizados')}>
                  Atualizar receipts
                </button>
              </div>

              {pushActionState.message ? <p className="push-ops-message">{pushActionState.message}</p> : null}
              {pushActionState.error ? <p className="form-error">{pushActionState.error}</p> : null}
            </section>

            <section className="page-shell notifications-push-card">
              <div className="notifications-section-head">
                <h2><Sparkles size={18} /> Devices</h2>
              </div>
              <div className="notifications-push-stack">
                {devices.length === 0 ? <p className="notifications-empty">Nenhum device ativo.</p> : null}
                {devices.map((device) => (
                  <article key={device.id} className="notifications-push-row">
                    <div>
                      <strong>{device.device_name || 'Device sem nome'}</strong>
                      <p>{device.platform} · {device.device_token}</p>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" disabled={pushActionState.loading} onClick={() => handleDeviceRemoval(device.device_token)}>
                      Remover
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="page-shell notifications-push-card">
              <div className="notifications-section-head">
                <h2><BellRing size={18} /> Entregas</h2>
              </div>
              <div className="notifications-push-stack">
                {pushDeliveries.length === 0 ? <p className="notifications-empty">Nenhuma entrega recente.</p> : null}
                {pushDeliveries.map((delivery) => (
                  <article key={delivery.id} className="notifications-push-row">
                    <div>
                      <strong>{delivery.notification_title || 'Push'}</strong>
                      <p>{delivery.status} · {delivery.platform} · {delivery.device_name || delivery.device_token}</p>
                      {delivery.error_message ? <span className="push-error-text">{delivery.error_message}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

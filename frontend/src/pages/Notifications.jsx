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

const NotificationsPage = () => {
  const navigate = useNavigate();
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
        error: error?.response?.data?.detail || 'Falha ao carregar o painel de notificações.',
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
    await loadData();
  };

  const startEditing = (notification) => {
    setEditingId(notification.id);
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

  const isCustomNotification = (notification) => (
    (notification.notification_type || notification.type) === 'custom_notification'
    && notification.source_feature === 'custom'
  );

  return (
    <div className="page-container fade-in reminders-page notifications-upgrade-page">
      <section className="notifications-hero glass-strong">
        <div>
          <span className="notifications-hero-kicker"><Sparkles size={16} /> {'Inbox operacional'}</span>
          <h1>{'Notificações'}</h1>
          <p>{'Pressão concentrada onde faz diferença, com ações rápidas e snooze sem sair da tela.'}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadData} disabled={pageState.loading || pushActionState.loading}>
          {pageState.loading ? 'Atualizando...' : 'Atualizar painel'}
        </button>
      </section>

      <section className="notifications-summary-grid">
        <article className="notification-summary-card glass-strong">
          <span>Unread</span>
          <strong>{summary.unread}</strong>
          <p>{'Itens ainda pedindo resposta.'}</p>
        </article>
        <article className="notification-summary-card glass-strong is-critical">
          <span>{'Críticas'}</span>
          <strong>{summary.critical}</strong>
          <p>{'Pressão real do sistema agora.'}</p>
        </article>
        <article className="notification-summary-card glass-strong">
          <span>{'Agendadas'}</span>
          <strong>{summary.scheduled}</strong>
          <p>{'Notificações com horário definido.'}</p>
        </article>
        <article className="notification-summary-card glass-strong">
          <span>Devices</span>
          <strong>{summary.devices}</strong>
          <p>{'Dispositivos móveis ativos.'}</p>
        </article>
      </section>

      {pageState.error ? <p className="form-error">{pageState.error}</p> : null}

      <section className="notifications-main-grid">
        <div className="notifications-inbox-column glass-strong">
          <div className="section-toolbar">
            <div>
              <h2><BellRing size={18} /> {'Inbox acionável'}</h2>
              <p>{filteredNotifications.length} {'item(ns) visível(is) no filtro atual.'}</p>
            </div>
            <div className="notifications-toolbar-actions">
              <select className="input" value={inboxFilter} onChange={(event) => setInboxFilter(event.target.value)}>
                {INBOX_FILTERS.map((filter) => <option key={filter} value={filter}>{filter === 'all' ? 'Todas severidades' : filter}</option>)}
              </select>
              <label className="checkbox-row">
                <input type="checkbox" checked={showOnlyUnread} onChange={(event) => setShowOnlyUnread(event.target.checked)} />
                <span>{'Apenas não lidas'}</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={showFuture} onChange={(event) => setShowFuture(event.target.checked)} />
                <span>{'Mostrar futuras'}</span>
              </label>
            </div>
          </div>

          <div className="notifications-bulk-bar">
            <span>{'Use o inbox como triagem rápida quando quiser limpar volume.'}</span>
            <div className="notifications-form-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={bulkLoading || filteredNotifications.length === 0} onClick={() => handleBulkAction('read')}>
                {'Marcar visíveis como lidas'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={bulkLoading || filteredNotifications.length === 0} onClick={() => handleBulkAction('completed')}>
                {'Concluir visíveis'}
              </button>
            </div>
          </div>

          <div className="notifications-inbox-list">
            {filteredNotifications.length === 0 ? <p className="review-empty">{'Nenhuma notificação nesse filtro.'}</p> : null}
            {filteredNotifications.map((notification) => {
              const details = buildNotificationMeta(notification);
              return (
                <article key={notification.id} className={`notification-upgrade-card severity-${notification.severity}`}>
                  <div className="notification-upgrade-topline">
                    <div>
                      <strong>{notification.title || 'Notificação'}</strong>
                      <p>{notification.message}</p>
                    </div>
                    <span className={`notification-status-pill status-${notification.severity}`}>{notification.severity}</span>
                  </div>

                  <div className="notification-upgrade-meta">
                    <span>{formatNotificationTimestamp(notification.scheduled_for || notification.created_at)}</span>
                    <span>{notification.status}</span>
                    {notification.is_due === false ? <span>{'agendada'}</span> : <span>{'ativa agora'}</span>}
                    {details.map((detail) => <span key={detail}>{detail}</span>)}
                  </div>

                  <div className="notifications-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => handleInboxAction(notification, 'open')}>
                      {getNotificationOpenLabel(notification)}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => handleInboxAction(notification, 'snooze')}>
                      <Clock3 size={14} /> {'Adiar '}{getNotificationSnoozeMinutes(notification)}m
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => handleInboxAction(notification, 'read')}>
                      {'Marcar lida'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => handleInboxAction(notification, 'complete')}>
                      {'Concluir'}
                    </button>
                    {isCustomNotification(notification) ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditing(notification)}>
                        {'Editar'}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="notifications-side-column">
          <form onSubmit={handleSubmit} className="glass-strong notifications-compose-card notifications-form-grid">
            <div className="section-toolbar">
              <div>
                <h2><Plus size={18} /> {'Notificação personalizada'}</h2>
                <p>{'Crie lembretes manuais com severidade e horário.'}</p>
              </div>
            </div>
            <input className="input" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder={'Título da notificação'} required />
            <textarea className="input" value={form.message} onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))} placeholder={'Descrição / mensagem'} maxLength={MAX_MESSAGE_LENGTH} />
            <input type="datetime-local" className="input" value={form.scheduled_for} onChange={(e) => setForm((current) => ({ ...current, scheduled_for: e.target.value }))} />
            <select className="input" value={form.severity} onChange={(e) => setForm((current) => ({ ...current, severity: e.target.value }))}>
              <option value="info">{'Informativa'}</option>
              <option value="success">{'Sucesso'}</option>
              <option value="warning">{'Aviso'}</option>
              <option value="critical">{'Crítica'}</option>
              <option value="neutral">{'Neutra'}</option>
            </select>
            <select className="input" value={form.color_token} onChange={(e) => setForm((current) => ({ ...current, color_token: e.target.value }))}>
              <option value="">{'Cor padrão'}</option>
              <option value="primary">{'Primária'}</option>
              <option value="accent">{'Destaque'}</option>
              <option value="success">{'Sucesso'}</option>
              <option value="warning">{'Aviso'}</option>
              <option value="danger">{'Perigo'}</option>
            </select>
            <select className="input" value={form.sound_key} onChange={(e) => setForm((current) => ({ ...current, sound_key: e.target.value }))}>
              <option value="">{'Sem som'}</option>
              <option value="default">{'Padrão'}</option>
              <option value="soft_chime">{'Toque suave'}</option>
              <option value="urgent_ping">{'Toque urgente'}</option>
            </select>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="notifications-form-actions">
              <button className="btn btn-primary">{editingId ? 'Salvar edição' : 'Criar notificação'}</button>
              {editingId ? <button type="button" className="btn btn-secondary" onClick={cancelEditing}>{'Cancelar'}</button> : null}
            </div>
          </form>

          <div className="glass-strong push-ops-card">
            <div className="section-toolbar">
              <div>
                <h2><Send size={18} /> {'Operação de push'}</h2>
                <p>{devices.length} {'device(s) ativos conectados ao backend.'}</p>
              </div>
              <select className="input push-status-filter" value={pushStatusFilter} onChange={(e) => setPushStatusFilter(e.target.value)}>
                {PUSH_FILTERS.map((status) => <option key={status} value={status}>{status === 'all' ? 'Todos os receipts' : status}</option>)}
              </select>
            </div>

            <div className="push-ops-actions">
              <button type="button" className="btn btn-secondary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: true }), 'Dry run executado')}>Dry run</button>
              <button type="button" className="btn btn-primary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: false }), 'Dispatch executado')}>{'Disparar push'}</button>
              <button type="button" className="btn btn-secondary" disabled={pushActionState.loading} onClick={() => runPushAction(() => notificationsApi.refreshPushReceipts({}), 'Receipts atualizados')}>{'Atualizar receipts'}</button>
            </div>

            {pushActionState.message ? <p className="push-ops-message">{pushActionState.message}</p> : null}
            {pushActionState.error ? <p className="form-error">{pushActionState.error}</p> : null}

            <div className="push-device-list">
              {devices.length === 0 ? <p>{'Nenhum device ativo registrado.'}</p> : null}
              {devices.map((device) => (
                <div key={device.id} className="push-device-row">
                  <div>
                    <strong>{device.device_name || 'Device sem nome'}</strong>
                    <div className="notification-meta">{device.platform} - {device.device_token}</div>
                    <div className="notification-meta">{'Atualizado em '}{device.updated_at || device.created_at || 'n/d'}</div>
                  </div>
                  <button type="button" className="btn btn-danger" disabled={pushActionState.loading} onClick={() => handleDeviceRemoval(device.device_token)}>
                    {'Remover'}
                  </button>
                </div>
              ))}
            </div>

            <div className="push-device-list">
              {pushDeliveries.map((delivery) => (
                <div key={delivery.id} className="push-delivery-row">
                  <div>
                    <strong>{delivery.notification_title || 'Push'}</strong>
                    <div className="notification-meta">{delivery.status} - {delivery.platform} - {delivery.device_name || delivery.device_token}</div>
                    {delivery.error_message ? <div className="push-error-text">{delivery.error_message}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NotificationsPage;

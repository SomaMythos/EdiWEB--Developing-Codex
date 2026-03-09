import React, { useEffect, useState } from 'react';
import { notificationsApi, dayPlanApi } from '../services/api';
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

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [consumableNotifications, setConsumableNotifications] = useState([]);
  const [plan, setPlan] = useState([]);
  const [devices, setDevices] = useState([]);
  const [pushDeliveries, setPushDeliveries] = useState([]);
  const [pushStatusFilter, setPushStatusFilter] = useState('all');
  const [pushActionState, setPushActionState] = useState({ loading: false, message: '', error: '' });
  const [pageState, setPageState] = useState({ loading: true, error: '' });
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const loadData = async () => {
    setPageState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const today = new Date().toISOString().slice(0, 10);
      const deliveryParams = pushStatusFilter === 'all' ? { limit: 20 } : { limit: 20, status: pushStatusFilter };
      const [n, c, p, d, deliveries] = await Promise.all([
        notificationsApi.list({ include_read: true, include_generated: true }),
        notificationsApi.listConsumables({ include_read: false, include_generated: true }),
        dayPlanApi.list(today),
        notificationsApi.listDevices(),
        notificationsApi.listPushDeliveries(deliveryParams),
      ]);
      setNotifications(n.data.data || []);
      setConsumableNotifications(c.data.data || []);
      setPlan(p.data.data || []);
      setDevices(d.data.data || []);
      setPushDeliveries(deliveries.data.data || []);
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
    if (!form.title.trim()) {
      return 'Título é obrigatório.';
    }

    if (form.scheduled_for) {
      const parsedDate = new Date(form.scheduled_for);
      if (Number.isNaN(parsedDate.getTime())) {
        return 'Data e hora inválidas.';
      }
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

  const handleStatus = async (id, status) => {
    await notificationsApi.updateStatus(id, status);
    await loadData();
  };

  const handleDeviceRemoval = async (deviceToken) => {
    await runPushAction(
      () => notificationsApi.deleteDevice(deviceToken),
      'Device removido',
    );
  };

  const getConsumableCta = (notificationType) => {
    if (notificationType === 'consumable_overdue') {
      return { label: 'Finalizar ciclo', href: '/consumiveis' };
    }
    return { label: 'Registrar reposição', href: '/consumiveis' };
  };

  const isCustomNotification = (notification) => (
    (notification.notification_type || notification.type) === 'custom_notification'
    && notification.source_feature === 'custom'
  );

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

  return (
    <div className="page-container fade-in reminders-page">
      <div className="reminders-page-header">
        <div>
          <h1>Notificações</h1>
          <p className="notification-meta">Painel unificado para inbox, devices móveis e entregas de push.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadData}
          disabled={pageState.loading || pushActionState.loading}
        >
          {pageState.loading ? 'Atualizando...' : 'Atualizar painel'}
        </button>
      </div>

      {pageState.error ? <p className="form-error">{pageState.error}</p> : null}

      <form onSubmit={handleSubmit} className="card reminders-card notifications-form-grid">
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
          placeholder="Título da notificação"
          required
        />
        <textarea
          className="input"
          value={form.message}
          onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
          placeholder="Descrição / mensagem"
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <input
          type="datetime-local"
          className="input"
          value={form.scheduled_for}
          onChange={(e) => setForm((current) => ({ ...current, scheduled_for: e.target.value }))}
        />
        <select
          className="input"
          value={form.severity}
          onChange={(e) => setForm((current) => ({ ...current, severity: e.target.value }))}
        >
          <option value="info">Informativa</option>
          <option value="success">Sucesso</option>
          <option value="warning">Aviso</option>
          <option value="critical">Crítica</option>
          <option value="neutral">Neutra</option>
        </select>
        <select
          className="input"
          value={form.color_token}
          onChange={(e) => setForm((current) => ({ ...current, color_token: e.target.value }))}
        >
          <option value="">Cor padrão</option>
          <option value="primary">Primária</option>
          <option value="accent">Destaque</option>
          <option value="success">Sucesso</option>
          <option value="warning">Aviso</option>
          <option value="danger">Perigo</option>
        </select>
        <select
          className="input"
          value={form.sound_key}
          onChange={(e) => setForm((current) => ({ ...current, sound_key: e.target.value }))}
        >
          <option value="">Sem som</option>
          <option value="default">Padrão</option>
          <option value="soft_chime">Toque suave</option>
          <option value="urgent_ping">Toque urgente</option>
        </select>

        {formError && <p className="form-error">{formError}</p>}

        <div className="notifications-form-actions">
          <button className="btn btn-primary">
            {editingId ? 'Salvar edição' : 'Criar notificação personalizada'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="card reminders-card push-ops-card">
        <div className="push-ops-header">
          <div>
            <h3>Operação de push</h3>
            <p>{devices.length} device(s) ativos conectados ao backend.</p>
          </div>
          <div className="push-ops-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pushActionState.loading}
              onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: true }), 'Dry run executado')}
            >
              Dry run
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pushActionState.loading}
              onClick={() => runPushAction(() => notificationsApi.dispatchPush({ dry_run: false }), 'Dispatch executado')}
            >
              Disparar push
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pushActionState.loading}
              onClick={() => runPushAction(() => notificationsApi.refreshPushReceipts({}), 'Receipts atualizados')}
            >
              Atualizar receipts
            </button>
          </div>
        </div>

        {pushActionState.message ? <p className="push-ops-message">{pushActionState.message}</p> : null}
        {pushActionState.error ? <p className="form-error">{pushActionState.error}</p> : null}

        <div className="push-device-list">
          {devices.length === 0 ? <p>Nenhum device ativo registrado.</p> : null}
          {devices.map((device) => (
            <div key={device.id} className="push-device-row">
              <div>
                <strong>{device.device_name || 'Device sem nome'}</strong>
                <div className="notification-meta">{device.platform} • {device.device_token}</div>
                <div className="notification-meta">Atualizado em {device.updated_at || device.created_at || 'n/d'}</div>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pushActionState.loading}
                onClick={() => handleDeviceRemoval(device.device_token)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card reminders-card">
        <div className="push-delivery-header">
          <h3>Entregas de push</h3>
          <select
            className="input push-status-filter"
            value={pushStatusFilter}
            onChange={(event) => setPushStatusFilter(event.target.value)}
          >
            {PUSH_FILTERS.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'Todos os status' : status}</option>
            ))}
          </select>
        </div>
        {pushDeliveries.length === 0 ? <p>Nenhuma entrega registrada.</p> : null}
        {pushDeliveries.map((delivery) => (
          <div key={delivery.id} className="push-delivery-row">
            <div>
              <strong>{delivery.notification_title || `Notification #${delivery.notification_id}`}</strong>
              <div className="notification-meta">
                {delivery.status} • {delivery.platform} • retry {delivery.retry_count ?? 0}
              </div>
              <div className="notification-meta">device #{delivery.device_id} • enviado em {delivery.sent_at || 'n/d'}</div>
              {delivery.ticket_id ? <div className="notification-meta">ticket: {delivery.ticket_id}</div> : null}
              {delivery.receipt_id ? <div className="notification-meta">receipt: {delivery.receipt_id}</div> : null}
              {delivery.error_message ? <div className="push-error-text">{delivery.error_message}</div> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="card reminders-card">
        <h3>Consumíveis com risco</h3>
        {consumableNotifications.length === 0 && (
          <p>Nenhum consumível precisa de ação no momento.</p>
        )}
        {consumableNotifications.map((n) => {
          const cta = getConsumableCta(n.notification_type || n.type);
          return (
            <div key={n.id} className="consumable-notification-row">
              <div>
                <strong>{n.meta?.item_name || n.title || 'Consumível'}</strong>
                <div>{n.message || 'Sem mensagem.'}</div>
              </div>
              <a className="btn btn-secondary" href={cta.href}>{cta.label}</a>
            </div>
          );
        })}
      </div>

      <div className="card reminders-card">
        <h3>Caixa de entrada de notificações</h3>
        {notifications.map((n) => (
          <div key={n.id} className="notification-row">
            <div>
              <strong>{n.title || n.notification_type}</strong> - {n.message || 'Sem mensagem.'}
              <div className="notification-meta">Status: {n.status}</div>
            </div>
            <div className="notification-row-actions">
              {isCustomNotification(n) && (
                <button type="button" className="btn btn-secondary" onClick={() => startEditing(n)}>
                  Editar
                </button>
              )}
              {n.status !== 'read' && n.status !== 'completed' && n.status !== 'canceled' && (
                <button type="button" className="btn btn-secondary" onClick={() => handleStatus(n.id, 'read')}>
                  Marcar como lida
                </button>
              )}
              {n.status !== 'completed' && n.status !== 'canceled' && (
                <button type="button" className="btn btn-primary" onClick={() => handleStatus(n.id, 'completed')}>
                  Concluir
                </button>
              )}
              {n.status !== 'canceled' && (
                <button type="button" className="btn btn-danger" onClick={() => handleStatus(n.id, 'canceled')}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card reminders-card">
        <h3>Blocos de hoje</h3>
        {plan.map((b) => (
          <div key={b.id}>{b.start_time} - {b.duration} min</div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;

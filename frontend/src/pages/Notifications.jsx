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

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [consumableNotifications, setConsumableNotifications] = useState([]);
  const [plan, setPlan] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const loadData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [n, c, p] = await Promise.all([
      notificationsApi.list({ include_read: true, include_generated: true }),
      notificationsApi.listConsumables({ include_read: false, include_generated: true }),
      dayPlanApi.list(today),
    ]);
    setNotifications(n.data.data || []);
    setConsumableNotifications(c.data.data || []);
    setPlan(p.data.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateForm = () => {
    if (!form.title.trim()) {
      return 'Título é obrigatório.';
    }

    if (form.scheduled_for) {
      const parsedDate = new Date(form.scheduled_for);
      if (Number.isNaN(parsedDate.getTime())) {
        return 'Data/hora inválida.';
      }
    }

    if ((form.message || '').trim().length > MAX_MESSAGE_LENGTH) {
      return `Mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`;
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

  const getConsumableCta = (notificationType) => {
    if (notificationType === 'consumable_overdue') {
      return { label: 'Finalizar ciclo', href: '/consumiveis' };
    }
    return { label: 'Registrar reposição', href: '/consumiveis' };
  };

  const isCustomNotification = (notification) =>
    (notification.notification_type || notification.type) === 'custom_notification'
    && notification.source_feature === 'custom';

  return (
    <div className="page-container fade-in reminders-page">
      <h1>Notificações</h1>
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
          <option value="info">Info</option>
          <option value="success">Sucesso</option>
          <option value="warning">Aviso</option>
          <option value="critical">Crítico</option>
          <option value="neutral">Neutro</option>
        </select>
        <select
          className="input"
          value={form.color_token}
          onChange={(e) => setForm((current) => ({ ...current, color_token: e.target.value }))}
        >
          <option value="">Cor padrão</option>
          <option value="primary">Primary</option>
          <option value="accent">Accent</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="danger">Danger</option>
        </select>
        <select
          className="input"
          value={form.sound_key}
          onChange={(e) => setForm((current) => ({ ...current, sound_key: e.target.value }))}
        >
          <option value="">Sem som</option>
          <option value="default">Default</option>
          <option value="soft_chime">Soft chime</option>
          <option value="urgent_ping">Urgent ping</option>
        </select>

        {formError && <p className="form-error">{formError}</p>}

        <div className="notifications-form-actions">
          <button className="btn btn-primary">
            {editingId ? 'Salvar edição' : 'Criar notificação custom'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

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
                <div>{n.message || 'Sem mensagem'}</div>
              </div>
              <a className="btn btn-secondary" href={cta.href}>{cta.label}</a>
            </div>
          );
        })}
      </div>

      <div className="card reminders-card">
        <h3>Inbox de notificações</h3>
        {notifications.map((n) => (
          <div key={n.id} className="notification-row">
            <div>
              <strong>{n.title || n.notification_type}</strong> - {n.message || 'Sem mensagem'}
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
                  Marcar lida
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

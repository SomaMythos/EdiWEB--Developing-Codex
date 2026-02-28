import React, { useEffect, useState } from 'react';
import { notificationsApi, dayPlanApi } from '../services/api';
import './Reminders.css';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [consumableNotifications, setConsumableNotifications] = useState([]);
  const [plan, setPlan] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

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

  const addNotification = async (event) => {
    event.preventDefault();
    await notificationsApi.createCustom({
      notification_type: 'custom_reminder',
      source_feature: 'manual',
      title,
      message,
      severity: 'info',
      status: 'unread',
    });
    setTitle('');
    setMessage('');
    loadData();
  };

  const getConsumableCta = (notificationType) => {
    if (notificationType === 'consumable_overdue') {
      return { label: 'Finalizar ciclo', href: '/consumiveis' };
    }
    return { label: 'Registrar reposição', href: '/consumiveis' };
  };

  return (
    <div className="page-container fade-in reminders-page">
      <h1>Notificações</h1>
      <form onSubmit={addNotification} className="card reminders-card">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da notificação"
          required
        />
        <input
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem (opcional)"
        />
        <button className="btn btn-primary">Criar notificação custom</button>
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
          <div key={n.id}>
            <strong>{n.title || n.notification_type}</strong> - {n.message || 'Sem mensagem'}
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

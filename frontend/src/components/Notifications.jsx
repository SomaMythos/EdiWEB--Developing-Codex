import React, { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, Calendar, TrendingDown } from 'lucide-react';
import { notificationsApi } from '../services/api';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Reload notifications every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data.data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'stalled_goal':
        return <AlertCircle size={20} className="icon-warning" />;
      case 'upcoming_deadline':
        return <Calendar size={20} className="icon-primary" />;
      case 'daily_summary':
        return <TrendingDown size={20} className="icon-success" />;
      default:
        return <Bell size={20} />;
    }
  };

  const getNotificationClass = (type) => {
    switch (type) {
      case 'stalled_goal':
        return 'notification-warning';
      case 'upcoming_deadline':
        return 'notification-primary';
      case 'daily_summary':
        return 'notification-success';
      default:
        return '';
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="notifications-container">
      <button 
        className="notifications-button"
        onClick={() => setShow(!show)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount}</span>
        )}
      </button>

      {show && (
        <div className="notifications-dropdown fade-in">
          <div className="notifications-header">
            <h3>Notificações</h3>
            <button 
              className="close-button"
              onClick={() => setShow(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="notifications-content">
            {loading ? (
              <div className="notifications-loading">
                <div className="spin">⏳</div>
                <p>Carregando...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">
                <Bell size={48} className="empty-icon" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notification, index) => (
                  <div 
                    key={index} 
                    className={`notification-item ${getNotificationClass(notification.type)}`}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-content">
                      <p className="notification-message">
                        {notification.message}
                      </p>
                      {notification.days_remaining !== undefined && (
                        <span className="notification-detail">
                          {notification.days_remaining} dias restantes
                        </span>
                      )}
                      {notification.total_activities !== undefined && (
                        <span className="notification-detail">
                          Taxa de conclusão: {Math.round(notification.completion_rate)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="notifications-footer">
            <button 
              className="btn btn-sm btn-secondary"
              onClick={loadNotifications}
              disabled={loading}
            >
              Atualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;

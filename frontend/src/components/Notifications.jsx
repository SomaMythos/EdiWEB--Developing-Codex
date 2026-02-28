import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertCircle, Calendar, TrendingDown } from 'lucide-react';
import { notificationsApi } from '../services/api';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

const buttonRef = useRef(null);
const dropdownRef = useRef(null);
const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    loadNotifications();
    // Reload notifications every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ include_generated: true, status: 'unread' });
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
		ref={buttonRef}
        className="notifications-button"
        onClick={() => {
  if (!show && buttonRef.current) {
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top,
      left: rect.right + 12
    });
  }
  setShow(!show);
}}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount}</span>
        )}
      </button>

      {show && (
        <div
  ref={dropdownRef}
  className="notifications-dropdown fade-in"
  style={{
    top: position.top,
    left: position.left
  }}
>
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
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${getNotificationClass((notification.notification_type || notification.type))}`}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon((notification.notification_type || notification.type))}
                    </div>
                    <div className="notification-content">
                      <p className="notification-message">
                        {notification.message}
                      </p>
                      {notification.meta?.days_remaining !== undefined && (
                        <span className="notification-detail">
                          {notification.meta.days_remaining} dias restantes
                        </span>
                      )}
                      {notification.meta?.completion_rate !== undefined && (
                        <span className="notification-detail">
                          Taxa de conclusão: {Math.round(notification.meta.completion_rate)}%
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

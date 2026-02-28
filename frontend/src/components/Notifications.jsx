import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  X,
  AlertCircle,
  Calendar,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import {
  getNewNotifications,
  loadSoundPreferences,
  notificationSoundPlayer,
  resolveSoundKey,
} from '../services/notificationSound';
import './Notifications.css';

const NOTIFICATION_SEVERITY_TAXONOMY = ['info', 'success', 'warning', 'critical', 'neutral'];

const TYPE_TO_SEVERITY = {
  stalled_goal: 'warning',
  upcoming_deadline: 'info',
  daily_summary: 'success',
  consumable_insufficient_history: 'info',
  consumable_restock_due: 'warning',
  consumable_overdue: 'critical',
  custom_reminder: 'info',
  custom_notification: 'info',
};

const TYPE_ICON_MAP = {
  stalled_goal: AlertCircle,
  upcoming_deadline: Calendar,
  daily_summary: TrendingDown,
  consumable_insufficient_history: Info,
  consumable_restock_due: AlertTriangle,
  consumable_overdue: AlertOctagon,
  custom_reminder: Bell,
  custom_notification: Bell,
};

const SEVERITY_ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertOctagon,
  neutral: Bell,
};

const getNotificationType = (notification) => notification.notification_type || notification.type || 'generic';

const getNotificationSeverity = (notification) => {
  const normalizedSeverity = notification?.severity?.toLowerCase();
  if (NOTIFICATION_SEVERITY_TAXONOMY.includes(normalizedSeverity)) {
    return normalizedSeverity;
  }

  const type = getNotificationType(notification);
  return TYPE_TO_SEVERITY[type] || 'neutral';
};

const getNotificationClass = (notification) => {
  const severity = getNotificationSeverity(notification);
  return `notification-severity-${severity}`;
};

const normalizeNotification = (notification) => {
  const severity = getNotificationSeverity(notification);
  return {
    ...notification,
    severity,
    sound_key: notification.sound_key || resolveSoundKey(notification, severity),
  };
};


const getNotificationIcon = (notification) => {
  const type = getNotificationType(notification);
  const severity = getNotificationSeverity(notification);
  const IconComponent = TYPE_ICON_MAP[type] || SEVERITY_ICON_MAP[severity] || SEVERITY_ICON_MAP.neutral;

  return <IconComponent size={20} className={`notification-icon-severity-${severity}`} />;
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const knownNotificationIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const showBrowserNotification = (notification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const sendNotification = () => {
      const title = notification?.title || 'EDI - Lembrete';
      const body = notification?.message || 'Você tem uma nova notificação.';
      try {
        const browserNotification = new Notification(title, { body, tag: `edi-${notification.id}` });
        setTimeout(() => browserNotification.close(), 8000);
      } catch (_error) {
        // Ignore browser notification failures.
      }
    };

    if (Notification.permission === 'granted') {
      sendNotification();
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') sendNotification();
      }).catch(() => {});
    }
  };

  const isRecentNotification = (notification, lookbackMs = 2 * 60 * 1000) => {
    const timestamp = notification?.scheduled_for
      || notification?.created_at
      || notification?.generated_at
      || null;
    if (!timestamp) return false;

    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return false;

    return (Date.now() - parsed.getTime()) <= lookbackMs;
  };

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spacing = 12;
    const viewportPadding = 12;
    const dropdownWidth = dropdownRef.current?.offsetWidth
      || Math.min(380, window.innerWidth - (viewportPadding * 2));
    const dropdownHeight = dropdownRef.current?.offsetHeight || 500;

    let left = rect.right - dropdownWidth;
    let top = rect.bottom + spacing;

    if (left + dropdownWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - dropdownWidth - viewportPadding;
    }

    left = Math.max(viewportPadding, left);

    if (top + dropdownHeight > window.innerHeight - viewportPadding) {
      top = rect.top - dropdownHeight - spacing;
    }

    if (top + dropdownHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - dropdownHeight - viewportPadding;
    }
    top = Math.max(viewportPadding, top);

    setPosition({ top, left });
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!show) return undefined;

    const frame = requestAnimationFrame(updateDropdownPosition);

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current
        && !dropdownRef.current.contains(event.target)
        && buttonRef.current
        && !buttonRef.current.contains(event.target)
      ) {
        setShow(false);
      }
    };

    const handleReposition = () => updateDropdownPosition();

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ include_generated: true, status: 'unread' });
      const nextNotifications = (res.data.data || []).map(normalizeNotification);

      const newNotifications = initializedRef.current
        ? getNewNotifications(nextNotifications, knownNotificationIdsRef.current)
        : nextNotifications.filter((notification) => isRecentNotification(notification));

      if (newNotifications.length > 0) {
        notificationSoundPlayer.playBatch({
          notifications: newNotifications,
          getSeverity: getNotificationSeverity,
          preferences: loadSoundPreferences(),
        });

        newNotifications.forEach(showBrowserNotification);
      }

      knownNotificationIdsRef.current = new Set(nextNotifications.map((item) => item.id));
      initializedRef.current = true;
      setNotifications(nextNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="notifications-container">
      <button
        ref={buttonRef}
        className="notifications-button"
        onClick={() => {
          if (!show) {
            updateDropdownPosition();
          }
          setShow((prev) => !prev);
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
            left: position.left,
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
                    className={`notification-item ${getNotificationClass(notification)}`}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification)}
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

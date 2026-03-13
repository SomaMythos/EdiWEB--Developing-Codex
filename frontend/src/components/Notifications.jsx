import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock3,
  Info,
  TrendingDown,
  X,
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import {
  getNewNotifications,
  loadSoundPreferences,
  notificationSoundPlayer,
  resolveSoundKey,
} from '../services/notificationSound';
import {
  buildNotificationMeta,
  formatNotificationTimestamp,
  getNotificationOpenLabel,
  getNotificationRoute,
  getNotificationSeverity,
  getNotificationSnoozeMinutes,
  getNotificationType,
  normalizeNotification,
} from '../utils/notificationHelpers';
import './Notifications.css';

const TYPE_ICON_MAP = {
  stalled_goal: AlertCircle,
  upcoming_deadline: Calendar,
  daily_summary: TrendingDown,
  consumable_insufficient_history: Info,
  consumable_restock_due: AlertTriangle,
  consumable_overdue: AlertOctagon,
  custom_reminder: Bell,
  custom_notification: Bell,
  daily_activity_start: Clock3,
  weekly_journal_prompt: Calendar,
};

const SEVERITY_ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertOctagon,
  neutral: Bell,
};

const PREVIEW_LIMIT = 6;

const getNotificationIcon = (notification) => {
  const type = getNotificationType(notification);
  const severity = getNotificationSeverity(notification);
  const IconComponent = TYPE_ICON_MAP[type] || SEVERITY_ICON_MAP[severity] || Bell;
  return <IconComponent size={18} className={`notification-icon-severity-${severity}`} />;
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
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
    const timestamp = notification?.scheduled_for || notification?.created_at || notification?.generated_at || null;
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
    const dropdownWidth = dropdownRef.current?.offsetWidth || Math.min(430, window.innerWidth - (viewportPadding * 2));
    const dropdownHeight = dropdownRef.current?.offsetHeight || 600;
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

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.list({ include_generated: true, status: 'unread', due_only: true });
      const nextNotifications = (response.data.data || []).map((item) => normalizeNotification({
        ...item,
        sound_key: item.sound_key || resolveSoundKey(item, getNotificationSeverity(item)),
      }));

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

  const previewNotifications = useMemo(() => notifications.slice(0, PREVIEW_LIMIT), [notifications]);
  const hiddenCount = Math.max(0, notifications.length - previewNotifications.length);
  const unreadCount = notifications.length;
  const criticalCount = useMemo(
    () => notifications.filter((notification) => notification.severity === 'critical').length,
    [notifications]
  );

  const runAction = async (notification, action) => {
    if (!notification?.id) return;
    setActionLoadingId(notification.id);
    try {
      if (action === 'open') {
        await notificationsApi.updateStatus(notification.id, 'read');
        navigate(getNotificationRoute(notification));
        setShow(false);
      } else if (action === 'read') {
        await notificationsApi.updateStatus(notification.id, 'read');
      } else if (action === 'complete') {
        await notificationsApi.updateStatus(notification.id, 'completed');
      } else if (action === 'snooze') {
        await notificationsApi.snooze(notification.id, getNotificationSnoozeMinutes(notification));
      }
      await loadNotifications();
    } catch (error) {
      console.error('Error applying notification action:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const markAllPreviewAsRead = async () => {
    if (previewNotifications.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(previewNotifications.map((notification) => notificationsApi.updateStatus(notification.id, 'read')));
      await loadNotifications();
    } catch (error) {
      console.error('Error marking preview notifications as read:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="notifications-container">
      <button
        ref={buttonRef}
        className={`notifications-button ${show ? 'is-open' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
        type="button"
        aria-label="Abrir notificações"
        aria-expanded={show}
        onClick={() => {
          if (!show) updateDropdownPosition();
          setShow((prev) => !prev);
        }}
      >
        <span className="notifications-button-icon">
          <Bell size={18} />
        </span>
        <span className="notifications-button-label">Notificações</span>
        {unreadCount > 0 ? (
          <span className="notifications-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : (
          <span className="notifications-button-meta">Inbox</span>
        )}
      </button>

      {show && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} className="notifications-dropdown fade-in" style={{ top: position.top, left: position.left }}>
          <div className="notifications-header">
            <div>
              <h3>{'Inbox de notificações'}</h3>
              <p>{criticalCount > 0 ? `${criticalCount} crítica(s) pedindo resposta.` : 'Sem alertas críticos no momento.'}</p>
            </div>
            <button className="close-button" onClick={() => setShow(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="notifications-top-strip">
            <span>{unreadCount} {'item(ns) acionável(is)'}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={markAllPreviewAsRead} disabled={bulkLoading || previewNotifications.length === 0}>
              {'Marcar preview como lida'}
            </button>
          </div>

          <div className="notifications-content glass-scrollbar">
            {loading ? (
              <div className="notifications-loading">
                <div className="spin">...</div>
                <p>{'Carregando...'}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">
                <Bell size={42} className="empty-icon" />
                <p>{'Nenhuma notificação vencida agora.'}</p>
              </div>
            ) : (
              <div className="notifications-list">
                {previewNotifications.map((notification) => {
                  const details = buildNotificationMeta(notification);
                  return (
                    <div key={notification.id} className={`notification-item notification-severity-${notification.severity}`}>
                      <div className="notification-icon">{getNotificationIcon(notification)}</div>
                      <div className="notification-content">
                        <div className="notification-heading-row">
                          <strong>{notification.title || 'Notificação'}</strong>
                          <span className={`notification-badge-pill badge-${notification.severity}`}>{notification.severity}</span>
                        </div>
                        <p className="notification-message">{notification.message}</p>
                        <div className="notification-meta-row">
                          <span>{formatNotificationTimestamp(notification.scheduled_for || notification.created_at)}</span>
                          {details.map((detail) => <span key={detail}>{detail}</span>)}
                        </div>
                        <div className="notification-actions-row">
                          <button type="button" className="btn btn-primary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => runAction(notification, 'open')}>
                            {getNotificationOpenLabel(notification)}
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => runAction(notification, 'snooze')}>
                            {'Adiar '}{getNotificationSnoozeMinutes(notification)}m
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => runAction(notification, 'read')}>
                            {'Marcar lida'}
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoadingId === notification.id} onClick={() => runAction(notification, 'complete')}>
                            {'Concluir'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hiddenCount > 0 ? <p className="notifications-hidden-count">+{hiddenCount} {'item(ns) no inbox completo.'}</p> : null}
              </div>
            )}
          </div>

          <div className="notifications-footer">
            <button className="btn btn-sm btn-secondary" onClick={loadNotifications} disabled={loading}>{'Atualizar'}</button>
            <Link to="/notifications" className="btn btn-sm btn-primary" onClick={() => setShow(false)}>
              {'Abrir inbox'}
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default Notifications;

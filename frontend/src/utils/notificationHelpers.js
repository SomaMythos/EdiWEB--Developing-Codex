export const NOTIFICATION_SEVERITY_TAXONOMY = ['info', 'success', 'warning', 'critical', 'neutral'];

export const TYPE_TO_SEVERITY = {
  stalled_goal: 'warning',
  upcoming_deadline: 'warning',
  daily_summary: 'success',
  consumable_insufficient_history: 'info',
  consumable_restock_due: 'warning',
  consumable_overdue: 'critical',
  custom_reminder: 'warning',
  custom_notification: 'info',
  daily_activity_start: 'warning',
  weekly_journal_prompt: 'warning',
};

export const getNotificationType = (notification) => notification.notification_type || notification.type || 'generic';

export const getNotificationSeverity = (notification) => {
  const normalizedSeverity = (notification.severity || '').toLowerCase();
  if (NOTIFICATION_SEVERITY_TAXONOMY.includes(normalizedSeverity)) {
    return normalizedSeverity;
  }
  return TYPE_TO_SEVERITY[getNotificationType(notification)] || 'neutral';
};

export const normalizeNotification = (notification) => ({
  ...notification,
  severity: getNotificationSeverity(notification),
});

export const getNotificationRoute = (notification) => {
  const type = getNotificationType(notification);
  const routeMap = {
    stalled_goal: '/goals',
    upcoming_deadline: '/goals',
    daily_summary: '/',
    daily_activity_start: '/',
    consumable_insufficient_history: '/shopping/consumiveis',
    consumable_restock_due: '/shopping/consumiveis',
    consumable_overdue: '/shopping/consumiveis',
    custom_reminder: '/notifications',
    custom_notification: '/notifications',
    weekly_journal_prompt: '/anotacoestab=journal',
  };
  return routeMap[type] || '/notifications';
};

export const getNotificationOpenLabel = (notification) => {
  const type = getNotificationType(notification);
  if (type === 'weekly_journal_prompt') return 'Abrir dirio';
  if (type === 'stalled_goal' || type === 'upcoming_deadline') return 'Abrir metas';
  if (type.startsWith('consumable_')) return 'Abrir consumveis';
  if (type === 'daily_activity_start' || type === 'daily_summary') return 'Abrir daily';
  return 'Abrir';
};

export const getNotificationSnoozeMinutes = (notification) => {
  const type = getNotificationType(notification);
  if (type === 'daily_activity_start') return 15;
  if (type === 'weekly_journal_prompt') return 180;
  if (type === 'consumable_overdue') return 720;
  return 30;
};

export const formatNotificationTimestamp = (value) => {
  if (!value) return 'Sem horrio';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const buildNotificationMeta = (notification) => {
  const meta = notification.meta || {};
  const details = [];
  if (typeof meta.days_remaining !== 'undefined') {
    details.push(`${meta.days_remaining} dias restantes`);
  }
  if (typeof meta.completion_rate !== 'undefined') {
    details.push(`Taxa de concluso: ${Math.round(meta.completion_rate)}%`);
  }
  if (typeof meta.snooze_count !== 'undefined' && meta.snooze_count > 0) {
    details.push(`Adiada ${meta.snooze_count}x`);
  }
  return details;
};

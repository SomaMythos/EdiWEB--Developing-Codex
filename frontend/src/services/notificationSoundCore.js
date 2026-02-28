export const SEVERITY_SOUND_MAP = {
  critical: 'critical',
  warning: 'warning',
  success: 'soft',
  info: 'default',
  neutral: 'default',
};

export const DEFAULT_SOUND_PREFERENCES = {
  enabled: true,
  volume: 0.7,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

const normalizeVolume = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return DEFAULT_SOUND_PREFERENCES.volume;
  return Math.min(1, Math.max(0, parsed));
};

export const normalizeSoundPreferences = (raw) => ({
  enabled: raw?.enabled ?? DEFAULT_SOUND_PREFERENCES.enabled,
  volume: normalizeVolume(raw?.volume),
  quietHoursEnabled: raw?.quietHoursEnabled ?? DEFAULT_SOUND_PREFERENCES.quietHoursEnabled,
  quietHoursStart: raw?.quietHoursStart || DEFAULT_SOUND_PREFERENCES.quietHoursStart,
  quietHoursEnd: raw?.quietHoursEnd || DEFAULT_SOUND_PREFERENCES.quietHoursEnd,
});

const timeToMinutes = (value) => {
  const [hoursStr = '0', minutesStr = '0'] = (value || '').split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return (hours * 60 + minutes) % (24 * 60);
};

export const isInQuietHours = (now, start, end) => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
};

export const shouldMuteByPreferences = (prefs, now = new Date()) => {
  if (!prefs.enabled || prefs.volume <= 0) return true;
  if (!prefs.quietHoursEnabled) return false;
  return isInQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd);
};

export const resolveSoundKey = (notification, severity, soundCatalog = {}) => {
  const directSound = notification?.sound_key;
  if (directSound && soundCatalog[directSound]) return directSound;
  return SEVERITY_SOUND_MAP[severity] || 'default';
};

export const getNewNotifications = (nextNotifications, knownIds) => nextNotifications
  .filter((notification) => notification?.id != null)
  .filter((notification) => !knownIds.has(notification.id));

export const createNotificationSoundPlayer = ({
  soundCatalog,
  debounceMs = 400,
  nowProvider = () => new Date(),
  createAudio = (src) => new Audio(src),
}) => {
  const lastPlayedBySoundKey = new Map();

  const playNotification = ({ notification, severity, preferences }) => {
    const prefs = normalizeSoundPreferences(preferences || DEFAULT_SOUND_PREFERENCES);
    const now = nowProvider();

    if (shouldMuteByPreferences(prefs, now)) return false;

    const soundKey = resolveSoundKey(notification, severity, soundCatalog);
    const src = soundCatalog[soundKey] || soundCatalog.default;
    if (!src) return false;

    const lastPlayed = lastPlayedBySoundKey.get(soundKey) || 0;
    if (now.getTime() - lastPlayed < debounceMs) return false;

    lastPlayedBySoundKey.set(soundKey, now.getTime());

    const audio = createAudio(src);
    audio.volume = prefs.volume;
    audio.play().catch(() => {});
    return true;
  };

  const playBatch = ({ notifications, getSeverity, preferences }) => {
    const sorted = [...notifications].sort((a, b) => (a.id || 0) - (b.id || 0));
    for (const notification of sorted) {
      const severity = getSeverity(notification);
      const played = playNotification({ notification, severity, preferences });
      if (played) return true;
    }
    return false;
  };

  return { playNotification, playBatch };
};

import defaultSound from '../assets/sounds/default.wav';
import warningSound from '../assets/sounds/warning.wav';
import criticalSound from '../assets/sounds/critical.wav';
import softSound from '../assets/sounds/soft.wav';
import {
  DEFAULT_SOUND_PREFERENCES,
  createNotificationSoundPlayer,
  getNewNotifications,
  normalizeSoundPreferences,
  resolveSoundKey,
} from './notificationSoundCore';

const STORAGE_KEY = 'edi.notification.sound.preferences';

export const SOUND_CATALOG = {
  default: defaultSound,
  warning: warningSound,
  critical: criticalSound,
  soft: softSound,
};

export const loadSoundPreferences = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND_PREFERENCES;
    return normalizeSoundPreferences(JSON.parse(raw));
  } catch (_error) {
    return DEFAULT_SOUND_PREFERENCES;
  }
};

export const saveSoundPreferences = (prefs) => {
  const normalized = normalizeSoundPreferences(prefs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const notificationSoundPlayer = createNotificationSoundPlayer({
  soundCatalog: SOUND_CATALOG,
});

export {
  DEFAULT_SOUND_PREFERENCES,
  getNewNotifications,
  resolveSoundKey,
};

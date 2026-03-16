export const THEME_SKIN_STORAGE_KEY = 'edi-theme-skin';
export const THEME_SKINS = ['legacy', 'custom'];
export const DEFAULT_THEME_SKIN = 'legacy';

export const normalizeThemeSkin = (value) => (
  THEME_SKINS.includes(value) ? value : DEFAULT_THEME_SKIN
);

export const readStoredThemeSkin = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_SKIN;
  }

  try {
    return normalizeThemeSkin(window.localStorage.getItem(THEME_SKIN_STORAGE_KEY));
  } catch (_) {
    return DEFAULT_THEME_SKIN;
  }
};

export const applyThemeSkinToDocument = (skin) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-skin', normalizeThemeSkin(skin));
};

export const persistThemeSkin = (skin) => {
  if (typeof window === 'undefined') {
    return normalizeThemeSkin(skin);
  }

  const normalized = normalizeThemeSkin(skin);
  try {
    window.localStorage.setItem(THEME_SKIN_STORAGE_KEY, normalized);
  } catch (_) {
    // ignore storage failures and still apply the skin in-memory
  }
  return normalized;
};

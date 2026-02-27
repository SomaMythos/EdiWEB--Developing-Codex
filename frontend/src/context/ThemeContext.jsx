import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'edi-theme-skin';
const DEFAULT_THEME = 'theme-glass';
const AVAILABLE_THEMES = ['theme-glass', 'theme-daedric', 'theme-flat'];
const ThemeContext = createContext(null);

const getInitialTheme = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return AVAILABLE_THEMES.includes(storedTheme) ? storedTheme : DEFAULT_THEME;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.remove(...AVAILABLE_THEMES);
    document.documentElement.classList.add(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      availableThemes: AVAILABLE_THEMES,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

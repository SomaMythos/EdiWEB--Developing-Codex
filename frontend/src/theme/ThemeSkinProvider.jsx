import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  applyThemeSkinToDocument,
  DEFAULT_THEME_SKIN,
  persistThemeSkin,
  readStoredThemeSkin,
  THEME_SKINS,
} from './skin';

const ThemeSkinContext = createContext({
  skin: DEFAULT_THEME_SKIN,
  availableSkins: THEME_SKINS,
  setSkin: () => {},
});

export function ThemeSkinProvider({ children }) {
  const [skin, setSkinState] = useState(() => readStoredThemeSkin());

  const setSkin = (nextSkin) => {
    const normalized = persistThemeSkin(nextSkin);
    applyThemeSkinToDocument(normalized);
    setSkinState(normalized);
  };

  const value = useMemo(() => ({
    skin,
    availableSkins: THEME_SKINS,
    setSkin,
  }), [skin]);

  return (
    <ThemeSkinContext.Provider value={value}>
      {children}
    </ThemeSkinContext.Provider>
  );
}

export function useThemeSkin() {
  return useContext(ThemeSkinContext);
}

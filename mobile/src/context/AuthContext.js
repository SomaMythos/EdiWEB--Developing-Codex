import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { setAuthToken } from '../api/client';
import { clearToken, loadToken, saveToken } from '../storage/session';
import { syncPushDeviceRegistration, unregisterPushDevice } from '../notifications/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [pushState, setPushState] = useState({ status: 'idle', reason: null });

  useEffect(() => {
    async function bootstrap() {
      const stored = await loadToken();
      if (stored) {
        setAuthToken(stored);
        setTokenState(stored);
      }
      setBootstrapped(true);
    }

    bootstrap();
  }, []);

  useEffect(() => {
    async function syncPush() {
      if (!token) {
        setPushState({ status: 'idle', reason: null });
        return;
      }

      setPushState({ status: 'syncing', reason: null });
      const result = await syncPushDeviceRegistration();
      if (result.ok) {
        setPushState({ status: 'registered', reason: null });
        return;
      }
      setPushState({ status: 'unavailable', reason: result.reason || 'unknown' });
    }

    syncPush();
  }, [token]);

  const value = useMemo(() => ({
    token,
    bootstrapped,
    pushState,
    async login(password) {
      const response = await authApi.login(password);
      const nextToken = response?.data?.data?.token;
      if (!nextToken) {
        throw new Error('Token n\u00e3o recebido.');
      }
      await saveToken(nextToken);
      setAuthToken(nextToken);
      setTokenState(nextToken);
    },
    async logout() {
      await unregisterPushDevice();
      await clearToken();
      setAuthToken(null);
      setTokenState(null);
      setPushState({ status: 'idle', reason: null });
    },
  }), [bootstrapped, pushState, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

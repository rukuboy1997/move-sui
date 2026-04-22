import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'myworld_session';

const AuthContext = createContext({
  user: null,
  address: null,
  isAuthenticated: false,
  isLoading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
  authModalOpen: false,
  authModalMode: 'signin',
});

let currentToken = null;
export function getAuthToken() {
  if (currentToken) return currentToken;
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return cached?.token || null;
  } catch {
    return null;
  }
}

function loadCached() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveCached(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    currentToken = session.token || null;
  } else {
    localStorage.removeItem(STORAGE_KEY);
    currentToken = null;
  }
}

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function apiPost(path, body) {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function AuthProvider({ children }) {
  const cached = loadCached();
  const [user, setUser] = useState(cached?.user || null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');

  // Initialize: hydrate token + verify session
  useEffect(() => {
    const c = loadCached();
    if (c?.token) {
      currentToken = c.token;
      // Validate against backend
      fetch(`${API_ORIGIN}/api/auth/me`, { headers: { Authorization: `Bearer ${c.token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            saveCached(null);
            setUser(null);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async ({ username, email, password }) => {
    const { user, token } = await apiPost('/auth/signup', { username, email, password });
    saveCached({ user, token });
    setUser(user);
    setAuthModalOpen(false);
    return user;
  }, []);

  const signIn = useCallback(async ({ username, password }) => {
    const { user, token } = await apiPost('/auth/login', { username, password });
    saveCached({ user, token });
    setUser(user);
    setAuthModalOpen(false);
    return user;
  }, []);

  const requestPasswordReset = useCallback(async ({ email }) => {
    return await apiPost('/auth/forgot-password', { email });
  }, []);

  const resetPassword = useCallback(async ({ email, code, newPassword }) => {
    const { user, token } = await apiPost('/auth/reset-password', { email, code, newPassword });
    saveCached({ user, token });
    setUser(user);
    setAuthModalOpen(false);
    return user;
  }, []);

  const signOut = useCallback(() => {
    saveCached(null);
    setUser(null);
  }, []);

  const openAuthModal = useCallback((mode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const value = {
    user,
    address: user?.address || null,
    isAuthenticated: !!user,
    isLoading,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    resetPassword,
    openAuthModal,
    closeAuthModal,
    authModalOpen,
    authModalMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

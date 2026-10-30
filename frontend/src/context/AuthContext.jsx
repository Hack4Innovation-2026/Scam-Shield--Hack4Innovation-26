import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(api.getToken()));

  const logout = useCallback(() => {
    api.setToken(null);
    setCurrentUser(null);
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!api.getToken()) return;
    api.fetchMe()
      .then(setCurrentUser)
      .catch(() => api.setToken(null))   // expired, revoked, or server unreachable: start signed out
      .finally(() => setLoading(false));
  }, []);

  // The server rejected the token mid-session (expired): sign out.
  useEffect(() => {
    window.addEventListener(api.UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(api.UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const startSession = ({ token, user }) => {
    api.setToken(token);
    setCurrentUser(user);
    return user;
  };

  const signupWithEmail = async (name, email, password) => startSession(await api.register(name, email, password));

  const loginWithEmail = async (email, password) => startSession(await api.login(email, password));

  const value = {
    currentUser,
    signupWithEmail,
    loginWithEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

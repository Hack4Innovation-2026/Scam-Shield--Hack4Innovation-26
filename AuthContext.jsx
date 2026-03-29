import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email/Password Signup (Mocked)
  const signupWithEmail = async (email, password, displayName) => {
    // We just fake an instant success
    const fakeUser = { uid: 'mock-uid-' + Date.now(), email, displayName: displayName || email.split('@')[0] };
    setCurrentUser(fakeUser);
    return { user: fakeUser };
  };

  // Email/Password Login (Mocked)
  const loginWithEmail = async (email, password) => {
    // We just fake an instant success for ANY email
    const fakeUser = { uid: 'mock-uid-' + Date.now(), email, displayName: email.split('@')[0] };
    setCurrentUser(fakeUser);
    return { user: fakeUser };
  };

  const logout = async () => {
    setCurrentUser(null);
  };

  useEffect(() => {
    // Simulating no real backend delay
    setLoading(false);
  }, []);

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

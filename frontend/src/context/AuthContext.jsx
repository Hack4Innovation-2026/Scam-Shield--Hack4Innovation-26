import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, firebaseEnabled } from '../config/firebase';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};

const notConfigured = () => {
  const err = new Error('Accounts are unavailable: Firebase is not configured. Continue as guest.');
  err.code = 'auth/not-configured';
  throw err;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  const signupWithEmail = async (email, password, displayName) => {
    if (!firebaseEnabled) notConfigured();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: displayName || email.split('@')[0] });
    return cred;
  };

  const loginWithEmail = async (email, password) => {
    if (!firebaseEnabled) notConfigured();
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    if (!firebaseEnabled) notConfigured();
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (firebaseEnabled) await signOut(auth);
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    firebaseEnabled,
    signupWithEmail,
    loginWithEmail,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // We ensure displayName is either what they set, or a default
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Anonymous',
          createdAt: Date.now(),
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (displayName: string) => {
    try {
      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, { displayName });
      // Update local state immediately before auth state changed fires again
      setUser({
        uid: userCredential.user.uid,
        displayName,
        createdAt: Date.now(),
      });
      // Save display name to local storage for convenience
      localStorage.setItem('syncwatch_displayname', displayName);
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

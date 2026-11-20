import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/auth';
import type { User } from '../types';
import { AuthContext } from './session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, account => {
    setUser(account?.displayName ? {
      uid: account.uid, displayName: account.displayName, createdAt: Date.now(),
    } : null);
    setLoading(false);
  }, () => setLoading(false)), []);

  async function login(name: string) {
    const displayName = name.trim();
    if (!displayName || displayName.length > 40) throw new Error('Enter a name of up to 40 characters.');
    const account = auth.currentUser || (await signInAnonymously(auth)).user;
    await updateProfile(account, { displayName });
    const profile = { uid: account.uid, displayName, createdAt: Date.now() };
    setUser(profile);
    try { localStorage.setItem('syncwatch_displayname', displayName); } catch { /* Storage is optional. */ }
    return profile;
  }
  return <AuthContext.Provider value={{ user, loading, login, logout: () => auth.signOut() }}>{children}</AuthContext.Provider>;
}

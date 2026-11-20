import { createContext, useContext } from 'react';
import type { User } from '../types';

interface Session {
  user: User | null;
  loading: boolean;
  login: (name: string) => Promise<User>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<Session | null>(null);

export function rememberedName() {
  try { return localStorage.getItem('syncwatch_displayname') || ''; }
  catch { return ''; }
}


export function useAuth() {
  const session = useContext(AuthContext);
  if (!session) throw new Error('Missing AuthProvider');
  return session;
}

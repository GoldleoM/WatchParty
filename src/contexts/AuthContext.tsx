import { useEffect, useState, type ReactNode } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase/auth';
import { AuthContext } from './session';
import type { User } from '../types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: User | null; pendingEmail: string | null; anonymous: boolean; loading: boolean }>({
    user: null, pendingEmail: null, anonymous: false, loading: true,
  });
  useEffect(() => {
    let revision = 0;
    const unsubscribe = onIdTokenChanged(auth, async account => {
      const current = ++revision;
      // Firestore reads the claim from the ID token, which can lag behind reload().
      const token = account?.emailVerified ? await account.getIdTokenResult().catch(() => null) : null;
      if (current !== revision) return;
      const verified = token?.claims.email_verified === true;
      setSession({
        user: account && verified ? { uid: account.uid, displayName: account.displayName || 'Viewer', createdAt: Date.parse(account.metadata.creationTime || '') } : null,
        pendingEmail: account?.email && !verified ? account.email : null,
        anonymous: !!account?.isAnonymous,
        loading: false,
      });
    });
    return () => { revision++; unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ ...session, logout: () => auth.signOut() }}>{children}</AuthContext.Provider>;
}

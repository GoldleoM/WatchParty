import { useState, type FormEvent, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/auth';
import { rememberedName, useAuth } from '../contexts/session';

function errorText(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/popup-blocked': return 'Allow the Google sign-in popup, then try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Google sign-in was cancelled.';
    case 'auth/account-exists-with-different-credential': return 'Sign in with the password for this email address.';
    case 'auth/email-already-in-use': return 'This email already has an account. Sign in or reset your password.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'Choose a stronger password with at least 8 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Check your email and password, then try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a moment before trying again.';
    default: return 'Could not complete this request. Check your connection and try again.';
  }
}

export function AccountGate({ children }: { children: ReactNode }) {
  const { loading, user, pendingEmail, anonymous, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(auth.currentUser?.isAnonymous ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(() => auth.currentUser?.displayName || rememberedName());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try { await action(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  function switchMode(next: typeof mode) {
    setMode(next); setPassword(''); setError(''); setMessage('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const address = email.trim();
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, address);
        setMessage('If this email has an account, check your inbox for a password reset link.');
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, address, password);
        setPassword('');
      } else {
        if (!name.trim()) { setError('Enter a display name.'); return; }
        const previous = auth.currentUser;
        const { user: account } = previous?.isAnonymous
          ? await linkWithCredential(previous, EmailAuthProvider.credential(address, password))
          : await createUserWithEmailAndPassword(auth, address, password);
        setPassword('');
        await updateProfile(account, { displayName: name.trim() });
        await account.getIdToken(true);
        await sendEmailVerification(account);
        setMessage('Verification email sent. Check your inbox and spam folder.');
      }
    });
  }
  if (loading) return <p className="loading-state" role="status">Restoring session…</p>;
  if (user) return <>{children}</>;
  const feedback = <>{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}</>;
  if (pendingEmail) return <section className="setup-wrap panel form-panel">
    <h1>Verify your email</h1><p>Open the Firebase verification link for <strong>{pendingEmail}</strong>, then return here to continue.</p>
    <div className="stack">{feedback}
      <button className="btn primary" disabled={busy} onClick={() => run(async () => {
        const account = auth.currentUser;
        if (!account) return;
        await account.reload();
        if (account.emailVerified) { setMode('login'); await account.getIdToken(true); }
        else setMessage('Still waiting for verification. Open the link in your email first.');
      })}>I verified my email</button>
      <button className="btn secondary" disabled={busy} onClick={() => run(async () => {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        setMessage('Verification email sent. Check your inbox and spam folder.');
      })}>Resend verification email</button>
      <button className="text-button" disabled={busy} onClick={() => run(async () => { await logout(); switchMode('login'); })}>Use another account</button>
    </div></section>;
  return <section className="setup-wrap panel form-panel">
    <h1>{mode === 'register' ? 'Create an account' : mode === 'reset' ? 'Reset your password' : 'Sign in'}</h1>
    <p>{anonymous ? 'Register an email and password in this browser to keep your existing rooms.' : 'Use a verified account to host or join a room.'}</p>
    {mode !== 'reset' && <button className="btn secondary" disabled={busy} onClick={() => run(async () => {
      const provider = new GoogleAuthProvider();
      const current = auth.currentUser;
      if (current?.isAnonymous) await linkWithPopup(current, provider);
      else await signInWithPopup(auth, provider);
    })}>Continue with Google</button>}
    <form className="stack" onSubmit={submit}>
      {mode === 'register' && <label>Your display name<input required maxLength={40} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} /></label>}
      <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {mode !== 'reset' && <label>Password<input type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
        {mode === 'register' && <small>Use at least 8 characters.</small>}</label>}
      {feedback}
      <button className="btn primary" disabled={busy}>{mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</button>
      {mode === 'login' && <button type="button" className="text-button" disabled={busy} onClick={() => switchMode('reset')}>Forgot password?</button>}
    </form></section>;
}

import { initializeApp } from 'firebase/app';

export const emulate = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true';
export const app = initializeApp(emulate ? {
  projectId: 'demo-watchparty', apiKey: 'demo-watchparty', authDomain: 'localhost',
} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

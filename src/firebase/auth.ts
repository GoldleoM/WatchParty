import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { app, emulate } from './app';

export const auth = getAuth(app);
if (emulate) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

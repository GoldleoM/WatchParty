import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { app, emulate } from './app';

export const db = getFirestore(app);
if (emulate) connectFirestoreEmulator(db, '127.0.0.1', 8080);

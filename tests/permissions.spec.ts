import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore/lite';
import { randomBytes } from 'node:crypto';

async function participant(name: string) {
  const app = initializeApp({ projectId: 'demo-watchparty', apiKey: 'demo-watchparty' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await signInAnonymously(auth);
  return { app, db, uid: user.uid };
}

test('room permissions protect the host timeline, member identity and closed chat', async () => {
  const host = await participant('host');
  const guest = await participant('guest');
  const id = randomBytes(3).toString('hex').toUpperCase();
  const now = Date.now();
  try {
    const room = doc(host.db, 'rooms', id);
    await setDoc(room, { roomId: id, hostUid: host.uid, hostName: 'Host', createdAt: now,
      videoType: 'local', videoUrl: 'https://example.test/file', playing: false,
      currentTime: 0, playbackRate: 1, lastUpdate: now });
    const member = { uid: guest.uid, displayName: 'Guest', joinedAt: now, lastActive: now, isReady: true, status: 'watching' };
    await setDoc(doc(guest.db, 'rooms', id, 'members', guest.uid), member);
    await expect(updateDoc(doc(guest.db, 'rooms', id), { playing: true })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(guest.db, 'rooms', id, 'members', host.uid), member)).rejects.toMatchObject({ code: 'permission-denied' });
    const message = doc(guest.db, 'rooms', id, 'messages', 'hello');
    await setDoc(message, { uid: guest.uid, displayName: 'Guest', text: 'Hello', timestamp: now });
    await setDoc(room, { closed: true });
    await expect(getDoc(message)).rejects.toMatchObject({ code: 'permission-denied' });
  } finally {
    await Promise.all([deleteApp(host.app), deleteApp(guest.app)]);
  }
});

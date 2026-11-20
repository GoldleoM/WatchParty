import { verificationCode } from './email';
import { expect, test } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, createUserWithEmailAndPassword, sendEmailVerification, applyActionCode } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore/lite';
import { randomBytes } from 'node:crypto';

async function participant(name: string) {
  const app = initializeApp({ projectId: 'demo-watchparty', apiKey: 'demo-watchparty' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const email = randomBytes(8).toString('hex') + '@example.test';
  const { user } = await createUserWithEmailAndPassword(auth, email, 'Example-test-42');
  await expect(getDoc(doc(db, 'rooms', 'ABC123'))).rejects.toMatchObject({ code: 'permission-denied' });
  await sendEmailVerification(user);
  await applyActionCode(auth, await verificationCode(email));
  await user.reload();
  await user.getIdToken(true);
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
      videoType: 'youtube', videoUrl: '', youtubeMode: 'videos', playing: false,
      currentTime: 0, playbackRate: 1, lastUpdate: now });
    const member = { uid: guest.uid, displayName: 'Guest', joinedAt: now, lastActive: now, isReady: true, status: 'watching', lastSeen: serverTimestamp() };
    await setDoc(doc(guest.db, 'rooms', id, 'members', guest.uid), member);
    await setDoc(doc(host.db, 'rooms', id, 'members', host.uid), { ...member, uid: host.uid, displayName: 'Host' });
    const queued = doc(guest.db, 'rooms', id, 'queue', 'M7lc1UVf-VE');
    await setDoc(queued, { id: queued.id, title: 'Party pick', short: false, uid: guest.uid, by: 'Guest', createdAt: serverTimestamp() });
    await expect(deleteDoc(queued)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(queued, { priority: serverTimestamp() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(guest.db, 'rooms', id), { youtubeMode: 'shorts' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(guest.db, 'rooms', id, 'youtube', 'browse'), { videos: [] })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(guest.db, 'rooms', id), { hostUid: guest.uid, hostName: 'Guest' })).rejects.toMatchObject({ code: 'permission-denied' });
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

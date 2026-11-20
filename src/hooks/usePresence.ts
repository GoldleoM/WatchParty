import { useEffect, useState } from 'react';
import { beforeAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/config';
import type { Room, RoomMember, User } from '../types';

const leaseMs = 90_000;
type Presence = RoomMember & { lastSeen?: Timestamp; enteredAt?: Timestamp; connections?: Record<string, Timestamp> };
function present(member: Presence, time: number) {
  return member.status !== 'offline' && time - (member.lastSeen?.toMillis() ?? member.lastActive) < leaseMs;
}

export function usePresence(room: Room, user: User) {
  const { roomId, hostUid, createdAt } = room;
  const [rows, setRows] = useState<Presence[]>([]);
  const [now, setNow] = useState(Date.now);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const members = collection(db, 'rooms', roomId, 'members');
    const own = doc(members, user.uid);
    let browserId: string = crypto.randomUUID();
    try {
      browserId = localStorage.getItem('watchparty-presence-browser') || browserId;
      localStorage.setItem('watchparty-presence-browser', browserId);
    } catch { /* The lease also works with a tab-local identity. */ }
    const tab = browserId + ':' + crypto.randomUUID();
    let active = true;
    let writing = false;

    async function presence(leaving: boolean, signingOut = false) {
      await runTransaction(db, async tx => {
        const previous = (await tx.get(own)).data() as Presence | undefined;
        if (!leaving && !active) return;
        if (leaving && (!previous?.connections || (!signingOut && !previous.connections[tab]))) return;
        const time = Date.now();
        const connections: Record<string, unknown> = {};
        for (const [id, seen] of Object.entries(previous?.connections || {})) {
          if (id !== tab && !(signingOut && id.startsWith(browserId + ':')) && time - seen.toMillis() < leaseMs) connections[id] = seen;
        }
        if (!leaving) connections[tab] = serverTimestamp();
        const continuing = previous && present(previous, time);
        tx.set(own, { uid: user.uid, displayName: user.displayName,
          status: Object.keys(connections).length ? (continuing ? previous.status : 'watching') : 'offline',
          isReady: continuing ? previous.isReady : false, connections,
          joinedAt: continuing ? previous.joinedAt : time, enteredAt: continuing && previous.enteredAt ? previous.enteredAt : serverTimestamp(),
          lastActive: time, lastSeen: serverTimestamp() });
      });
    }
    async function beat() {
      if (writing || !active) return;
      writing = true;
      try { await presence(false); if (active) { setJoined(true); setError(''); } }
      catch { if (active) setError('Could not update room presence. Reconnecting…'); }
      finally { writing = false; }
    }
    void beat();
    const unsubscribe = onSnapshot(members, snap => {
      setRows(snap.docs.map(d => d.data({ serverTimestamps: 'estimate' }) as Presence));
      setNow(Date.now());
    }, () => setError('Room presence is unavailable.'));
    const heartbeat = window.setInterval(beat, 20_000);
    const tick = window.setInterval(() => setNow(Date.now()), 3000);
    const release = () => presence(true).catch(() => {});
    const stopAuth = beforeAuthStateChanged(auth, next => {
      if (next?.uid !== user.uid) {
        active = false;
        // Signing out also works offline. Other viewers will then use lease expiry.
        return Promise.race([presence(true, true).catch(() => {}), new Promise<void>(resolve => window.setTimeout(resolve, 5000))]);
      }
    });
    window.addEventListener('online', beat);
    return () => {
      active = false; clearInterval(tick); clearInterval(heartbeat); unsubscribe(); stopAuth();
      window.removeEventListener('online', beat); void release();
    };
  }, [roomId, user.uid, user.displayName]);

  const members = rows.filter(m => present(m, now)).sort((a, b) =>
    (a.enteredAt?.toMillis() ?? a.joinedAt) - (b.enteredAt?.toMillis() ?? b.joinedAt) || a.uid.localeCompare(b.uid));
  const first = members[0]?.uid;
  const hostPresent = members.some(m => m.uid === hostUid);
  useEffect(() => {
    if (!joined || hostPresent || first !== user.uid || hostUid === user.uid) return;
    const ref = doc(db, 'rooms', roomId);
    void runTransaction(db, async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.closed || current.hostUid !== hostUid) return;
      const oldHost = (await tx.get(doc(ref, 'members', hostUid))).data() as Presence | undefined;
      if (oldHost ? present(oldHost, Date.now()) : Date.now() - createdAt < leaseMs) return;
      tx.update(ref, { hostUid: user.uid, hostName: user.displayName });
    }).catch(() => { /* The next tick retries after a concurrent host update or lease expiry. */ });
  }, [joined, hostPresent, first, user.uid, user.displayName, roomId, hostUid, createdAt, now]);

  const update = async (value: Partial<RoomMember>) => {
    if (!joined) return;
    try { await updateDoc(doc(db, 'rooms', roomId, 'members', user.uid), { ...value, lastActive: Date.now(), lastSeen: serverTimestamp() }); }
    catch { setError('Could not update your status. Try again.'); }
  };
  return { joined, error, members, toggleReady: (ready: boolean) => update({ isReady: !ready }),
    updateStatus: (status: RoomMember['status']) => update({ status }) };
}

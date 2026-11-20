import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { User, RoomMember } from '../types';

const heartbeatMs = 25_000;

export function usePresence(roomId: string, user: User) {
  const [rows, setRows] = useState<RoomMember[]>([]);
  const [now, setNow] = useState(Date.now);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const members = collection(db, 'rooms', roomId, 'members');
    const own = doc(members, user.uid);
    let active = true;
    async function enter() {
      await runTransaction(db, async tx => {
        const previous = (await tx.get(own)).data();
        if (!active) return;
        const time = Date.now();
        tx.set(own, { uid: user.uid, displayName: user.displayName, status: 'watching',
          isReady: previous?.isReady === true && time - previous.lastActive < heartbeatMs * 3,
          joinedAt: previous?.joinedAt || time, lastActive: time });
      });
      if (active) { setJoined(true); setError(''); }
    }
    function report() { if (active) setError('Could not update room presence. Reconnecting…'); }
    enter().catch(report);
    const unsubscribe = onSnapshot(members, snap => {
      setNow(Date.now());
      setRows(snap.docs.map(d => d.data() as RoomMember));
    }, report);
    // Let the heartbeat expire on exit so closing one tab cannot evict another.
    const beat = () => {
      setNow(Date.now());
      updateDoc(own, { lastActive: Date.now() }).then(() => {
        if (active) { setJoined(true); setError(''); }
      }).catch(() => { if (active) enter().catch(report); });
    };
    const timer = window.setInterval(beat, heartbeatMs);
    window.addEventListener('online', beat);
    return () => { active = false; unsubscribe(); clearInterval(timer); window.removeEventListener('online', beat); };
  }, [roomId, user.uid, user.displayName]);

  const update = async (value: Partial<RoomMember>) => {
    if (!joined) return;
    try { await updateDoc(doc(db, 'rooms', roomId, 'members', user.uid), { ...value, lastActive: Date.now() }); setError(''); }
    catch { setError('Could not update your status. Try again.'); }
  };
  return { joined, error, members: rows.filter(m => now - m.lastActive < heartbeatMs * 3),
    toggleReady: (ready: boolean) => update({ isReady: !ready }),
    updateStatus: (status: RoomMember['status']) => update({ status }) };
}

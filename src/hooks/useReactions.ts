import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Reaction, User } from '../types';

export function useReactions(roomId: string, user: User, joined: boolean) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!joined) return;
    const timers = new Set<number>();
    const recent = query(collection(db, 'rooms', roomId, 'reactions'), where('timestamp', '>', Date.now() - 5000), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(recent, snap => {
      for (const change of snap.docChanges()) {
        const reaction = { ...change.doc.data(), id: change.doc.id } as Reaction;
        if (change.type !== 'added' || Date.now() - reaction.timestamp >= 5000) continue;
        setReactions(prev => [...prev, reaction]);
        const timer = window.setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reaction.id));
          timers.delete(timer);
        }, 2400);
        timers.add(timer);
      }
    }, () => setError('Reactions could not connect.'));
    return () => { unsubscribe(); timers.forEach(clearTimeout); };
  }, [roomId, joined]);
  async function sendReaction(emoji: string) {
    try {
      await addDoc(collection(db, 'rooms', roomId, 'reactions'), { uid: user.uid, emoji, timestamp: Date.now() });
      setError('');
    } catch { setError('Could not send your reaction. Try again.'); }
  }
  return { reactions, sendReaction, error };
}

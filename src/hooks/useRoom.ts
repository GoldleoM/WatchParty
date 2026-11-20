import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Room } from '../types';

export function useRoom(id: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(doc(db, 'rooms', id), snapshot => {
    if (!snapshot.exists() || snapshot.data().closed) {
      setRoom(null);
      setError('This room has closed or the invite code is incorrect.');
    } else {
      setError('');
      setRoom({ ...snapshot.data(), roomId: id } as Room);
    }
  }, () => { setRoom(null); setError('Could not reach this room. Check your connection and retry.'); }), [id]);
  return { room, error };
}

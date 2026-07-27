import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Room, User } from '../types';

export const useRoom = (roomId: string | undefined, user: User | null = null) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !user) {
      // Don't set loading to false here immediately if there's no user,
      // because we want the login screen to handle the unauthenticated state
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId),
      (docSnap) => {
        if (docSnap.exists()) {
          setRoom(docSnap.data() as Room);
          setError(null);
        } else {
          setRoom(null);
          setError('Room not found or has been deleted.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching room:', err);
        setError('Failed to load room data.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId, user]);

  return { room, loading, error };
};

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Reaction, User } from '../types';

export const useReactions = (roomId: string | undefined, user: User | null) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    if (!roomId) return;

    // Only fetch reactions from the last 10 seconds to avoid fetching old ones
    const recentThreshold = Date.now() - 10000;
    const reactionsRef = collection(db, `rooms/${roomId}/reactions`);
    const q = query(
      reactionsRef, 
      where('timestamp', '>', recentThreshold),
      orderBy('timestamp', 'desc'), 
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const reaction = { id: change.doc.id, ...change.doc.data() } as Reaction;
          
          // Only show if it's actually recent (within 5 seconds) 
          // because onSnapshot might fire for existing docs on first load
          if (Date.now() - reaction.timestamp < 5000) {
            setReactions(prev => [...prev, reaction]);
            
            // Remove after 2.5 seconds (allowing time for the 2s animation to finish)
            setTimeout(() => {
              setReactions(prev => prev.filter(r => r.id !== reaction.id));
            }, 2500);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [roomId]);

  const sendReaction = async (emoji: string) => {
    if (!roomId || !user) return;

    try {
      const reactionsRef = collection(db, `rooms/${roomId}/reactions`);
      await addDoc(reactionsRef, {
        uid: user.uid,
        emoji,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('Failed to send reaction', e);
    }
  };

  return { reactions, sendReaction };
};

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { User, RoomMember } from '../types';

export const usePresence = (roomId: string | undefined, user: User | null) => {
  const [members, setMembers] = useState<RoomMember[]>([]);

  useEffect(() => {
    if (!roomId || !user) return;

    const membersRef = collection(db, `rooms/${roomId}/members`);
    const userDocRef = doc(membersRef, user.uid);

    // Join room
    const joinRoom = async () => {
      await setDoc(userDocRef, {
        uid: user.uid,
        displayName: user.displayName,
        isReady: false,
        status: 'watching',
        joinedAt: Date.now(),
        lastActive: Date.now(),
      });
    };

    joinRoom();

    // Listen to members
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const currentMembers: RoomMember[] = [];
      snapshot.forEach((doc) => {
        currentMembers.push(doc.data() as RoomMember);
      });
      setMembers(currentMembers);
    });

    // Cleanup on unmount (leave room)
    return () => {
      unsubscribe();
      deleteDoc(userDocRef).catch(console.error);
    };
  }, [roomId, user]);

  const updateStatus = async (status: 'watching' | 'buffering' | 'offline') => {
    if (!roomId || !user) return;
    try {
      await updateDoc(doc(db, `rooms/${roomId}/members/${user.uid}`), {
        status,
        lastActive: Date.now(),
      });
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  const toggleReady = async (currentReadyState: boolean) => {
    if (!roomId || !user) return;
    try {
      await updateDoc(doc(db, `rooms/${roomId}/members/${user.uid}`), {
        isReady: !currentReadyState,
        lastActive: Date.now(),
      });
    } catch (e) {
      console.error('Failed to toggle ready state', e);
    }
  };

  return { members, updateStatus, toggleReady };
};

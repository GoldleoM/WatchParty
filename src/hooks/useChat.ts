import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ChatMessage, User } from '../types';

export const useChat = (roomId: string | undefined, user: User | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const messagesRef = collection(db, `rooms/${roomId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        newMessages.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(newMessages.reverse()); // Reverse to have oldest at top, newest at bottom
    });

    return () => unsubscribe();
  }, [roomId]);

  const sendMessage = async (text: string) => {
    if (!roomId || !user || !text.trim()) return;

    try {
      const messagesRef = collection(db, `rooms/${roomId}/messages`);
      await addDoc(messagesRef, {
        uid: user.uid,
        displayName: user.displayName,
        text: text.trim(),
        timestamp: Date.now(), // using client time for immediate sort, or serverTimestamp() if preferred
      });
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  return { messages, sendMessage };
};

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ChatMessage, User } from '../types';

export function useChat(roomId: string, user: User) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const latest = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(latest, snap => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id }) as ChatMessage).reverse());
      setError('');
    }, () => setError('Chat could not connect. Reopen the room to retry.'));
  }, [roomId]);
  async function sendMessage(text: string) {
    await addDoc(collection(db, 'rooms', roomId, 'messages'), {
      uid: user.uid, displayName: user.displayName, text: text.trim(), timestamp: Date.now(),
    });
  }
  return { messages, error, sendMessage };
}

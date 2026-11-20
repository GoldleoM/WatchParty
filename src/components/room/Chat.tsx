import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MdChatBubbleOutline, MdSend } from 'react-icons/md';
import { useChat } from '../../hooks/useChat';
import type { User } from '../../types';

export function Chat({ roomId, user }: { roomId: string; user: User }) {
  const { messages, sendMessage, error } = useChat(roomId, user);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      follow.current = true;
      await sendMessage(draft);
      setDraft(current => current === draft ? '' : current);
    } catch { setSendError('Message could not be sent. Your draft is saved here.'); }
    finally { setSending(false); }
  }
  return <section className="panel chat">
    <h2><MdChatBubbleOutline /> Room chat</h2>
    <div className="chat-log" role="log" aria-label="Room messages" ref={list} onScroll={e => {
      const el = e.currentTarget;
      follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    }}>
      {messages.length === 0 && <p className="empty-chat">Say hello to the room.</p>}
      {messages.map(msg => <div key={msg.id} className={'message' + (msg.uid === user.uid ? ' own' : '')}>
        <b>{msg.displayName}</b><p>{msg.text}</p>
      </div>)}
    </div>
    {(error || sendError) && <p role="alert" className="error">{sendError || error}</p>}
    <form onSubmit={send} className="chat-form"><input aria-label="Message" maxLength={2000} value={draft} placeholder="Message the room…" onChange={e => setDraft(e.target.value)} />
      <button className="btn primary icon-btn" aria-label="Send message" disabled={!draft.trim() || sending}><MdSend /></button>
    </form>
  </section>;
}

import React, { useState, useRef, useEffect } from 'react';
import { MdSend } from 'react-icons/md';
import { useChat } from '../../hooks/useChat';
import type { User } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

interface ChatProps {
  roomId: string | undefined;
  user: User | null;
}

export const Chat: React.FC<ChatProps> = ({ roomId, user }) => {
  const { messages, sendMessage } = useChat(roomId, user);
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <div className="flex flex-col h-full bg-card/50 rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border bg-card">
        <h3 className="font-semibold text-sm">Room Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.uid === user?.uid;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <Avatar name={msg.displayName} size="sm" className="flex-shrink-0" />
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <span className="text-xs text-muted-foreground mb-1 mx-1">{msg.displayName}</span>
                <div 
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-secondary text-secondary-foreground rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={!text.trim()} className="px-3">
          <MdSend className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};

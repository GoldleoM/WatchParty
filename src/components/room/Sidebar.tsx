import { useState } from 'react';
import { MdCheck, MdGroup } from 'react-icons/md';
import type { Room, RoomMember, User } from '../../types';
import { Chat } from './Chat';

interface Props {
  room: Room;
  members: RoomMember[];
  user: User;
  joined: boolean;
  toggleReady: (current: boolean) => Promise<void>;
  transfer: (member: RoomMember) => Promise<void>;
  close: () => Promise<void>;
}

export function Sidebar({ room, members, user, joined, toggleReady, transfer, close }: Props) {
  const me = members.find(m => m.uid === user.uid);
  const host = room.hostUid === user.uid;
  const [confirmation, setConfirmation] = useState<RoomMember | 'close' | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!confirmation || busy) return;
    setBusy(true);
    try { if (confirmation === 'close') await close(); else await transfer(confirmation); }
    finally { setBusy(false); setConfirmation(null); }
  }
  return <aside className="room-sidebar">
    <section className="panel guests">
      <h2><MdGroup /> In the room <span className="count">{members.length}</span></h2>
      <ul>{members.map(m => <li key={m.uid}>
        <span className="avatar" aria-hidden="true">{Array.from(m.displayName)[0]}</span>
        <div className="member"><strong>{m.displayName}{m.uid === user.uid ? ' (you)' : ''}</strong>
          <small>{[m.uid === room.hostUid && 'Host', m.status === 'buffering' ? 'Buffering' : m.isReady ? 'Ready' : 'Getting ready'].filter(Boolean).join(' · ')}</small></div>
        {host && m.uid !== user.uid && <button className="text-button" disabled={busy} onClick={() => setConfirmation(m)}>Make host</button>}
      </li>)}</ul>
      {me && <button className="btn secondary" aria-pressed={me.isReady} onClick={() => toggleReady(me.isReady)}>
        <MdCheck /> {me.isReady ? 'Ready to watch' : 'Mark ready'}</button>}
      {host && <button className="text-button close-room" onClick={() => setConfirmation('close')}>Close room</button>}
      {host && confirmation && <div className="confirm-box">
        <p>{confirmation === 'close' ? 'Close this room for everyone? The invite will stop working.' : 'Give playback controls to ' + confirmation.displayName + '?'}</p>
        <div><button className="btn secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={confirm}>{confirmation === 'close' ? 'Yes, close room' : 'Transfer host'}</button></div>
      </div>}
    </section>
    {joined ? <Chat roomId={room.roomId} user={user} /> : <div className="panel chat"><p role="status">Connecting to chat…</p></div>}
  </aside>;
}

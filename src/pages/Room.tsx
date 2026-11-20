import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { MdContentCopy, MdFolderOpen } from 'react-icons/md';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/session';
import { useRoom } from '../hooks/useRoom';
import { usePresence } from '../hooks/usePresence';
import { useReactions } from '../hooks/useReactions';
import { Screen } from '../components/video/Screen';
import { YouTubeRoom } from '../components/youtube/YouTubeRoom';
import { Sidebar } from '../components/room/Sidebar';
import { roomCodeFrom } from '../utils/links';
import type { Room as RoomData, RoomMember, User } from '../types';

const emoji = [['😂','Laugh'], ['😭','Cry'], ['🔥','Fire'], ['❤️','Love'], ['👏','Applaud'], ['👀','Eyes'], ['🤯','Mind blown']];

function RoomSession({ room, user }: { room: RoomData; user: User }) {
  const presence = usePresence(room, user);
  const { reactions, sendReaction, error: reactionError } = useReactions(room.roomId, user, presence.joined);
  const [localUrl, setLocalUrl] = useState('');
  const [error, setError] = useState('');
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const navigate = useNavigate();
  const host = room.hostUid === user.uid;
  const invite = window.location.origin + '/room/' + room.roomId;
  const sourceName = { youtube: 'YouTube', mp4: 'Direct video', local: 'Local file' }[room.videoType];
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  useEffect(() => {
    if (copy !== 'copied') return;
    const timer = setTimeout(() => setCopy('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copy]);
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite); setCopy('copied'); }
    catch { setCopy('manual'); }
  }
  async function close() {
    try { await setDoc(doc(db, 'rooms', room.roomId), { closed: true }); navigate('/', { replace: true }); }
    catch { setError('Could not close the room. Check your connection and try again.'); }
  }
  async function transfer(member: RoomMember) {
    try { await updateDoc(doc(db, 'rooms', room.roomId), { hostUid: member.uid, hostName: member.displayName }); setError(''); }
    catch { setError('Could not transfer the room. Check that the guest is still here.'); }
  }
  const fileInput = <label className="btn secondary file-control"><MdFolderOpen />{localUrl ? 'Change file' : 'Choose video file'}
    <input className="visually-hidden" type="file" accept="video/*" onChange={e => {
      const file = e.target.files?.[0];
      if (file) setLocalUrl(URL.createObjectURL(file));
      e.target.value = '';
    }} /></label>;
  return <div className="shell watch-room">
    <header className="room-heading">
      <div><h1>Room <span>{room.roomId}</span></h1><p>{sourceName} · Hosted by {host ? 'you' : room.hostName}</p></div>
      <button className="btn secondary" onClick={copyInvite}><MdContentCopy /><span aria-live="polite">{copy === 'copied' ? 'Link copied' : 'Copy invite'}</span></button>
    </header>
    {copy === 'manual' && <label className="manual-invite">Copy this invite link<input value={invite} readOnly onFocus={e => e.target.select()} /></label>}
    {(error || presence.error || reactionError) && <p role="alert" className="error">{error || presence.error || reactionError}</p>}
    <div className="room-grid">
      <section className="watch-column" aria-label="Screening">
        {room.videoType === 'youtube' ? <YouTubeRoom room={room} user={user} joined={presence.joined} reactions={reactions} onBuffer={b => presence.updateStatus(b ? 'buffering' : 'watching')} /> : room.videoType === 'local' && !localUrl ? <div className="local-prompt">
          <MdFolderOpen /><h2>Choose your copy</h2>
          <p>Each person needs the same video file. Open the host’s download link, then select your copy here.</p>
          {/^https?:\/\//i.test(room.videoUrl) && <a className="text-button" href={room.videoUrl} target="_blank" rel="noreferrer">Open download link</a>}{fileInput}
        </div> : <Screen key={String(host) + localUrl} host={host} room={room} url={localUrl || room.videoUrl} reactions={reactions} onBuffer={b => presence.updateStatus(b ? 'buffering' : 'watching')} />}
        {room.videoType === 'local' && localUrl && <div className="file-info">{fileInput}</div>}
        <div className="reaction-bar" role="group" aria-label="Send a reaction"><span>React</span>
          {emoji.map(([symbol, name]) => <button key={name} aria-label={name} title={name} disabled={!presence.joined} onClick={() => sendReaction(symbol)}>{symbol}</button>)}</div>
      </section>
      <Sidebar room={room} user={user} members={presence.members} joined={presence.joined} toggleReady={presence.toggleReady} transfer={transfer} close={close} />
    </div>
  </div>;
}

function ConnectedRoom({ id, user }: { id: string; user: User }) {
  const { room, error } = useRoom(id);
  if (error) return <RoomError detail={error} />;
  if (!room) return <p className="loading-state" role="status">Opening room…</p>;
  return <RoomSession room={room} user={user} />;
}
function RoomError({ detail }: { detail: string }) {
  return <section className="setup-wrap panel form-panel"><h1>Room unavailable</h1><p>{detail}</p>
    <Link className="btn secondary" to="/">Return to lobby</Link></section>;
}
export function Room() {
  const { roomId = '' } = useParams();
  const id = roomCodeFrom(roomId);
  const { user } = useAuth();
  if (!id) return <RoomError detail="Check the six-character code in your invite." />;
  return user && <ConnectedRoom key={id + user.uid} id={id} user={user} />;
}

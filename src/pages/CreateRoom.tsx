import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, runTransaction } from 'firebase/firestore';
import { MdArrowBack, MdFolderOpen, MdLink, MdMovieCreation, MdOndemandVideo } from 'react-icons/md';
import { rememberedName, useAuth } from '../contexts/session';
import { db } from '../firebase/config';
import type { Room, VideoType } from '../types';
import { generateRoomId } from '../utils/cn';
import { videoLink } from '../utils/links';

const sources = [
  { type: 'youtube', name: 'YouTube', icon: MdOndemandVideo, label: 'YouTube video link', hint: 'Use a watch link, Short, or share link for a video that allows embedding.' },
  { type: 'mp4', name: 'Video link', icon: MdLink, label: 'Direct video link', hint: 'Use an HTTPS link to a playable video file, such as an MP4.' },
  { type: 'local', name: 'Local file', icon: MdFolderOpen, label: 'File download link', hint: 'Share a download link. Everyone selects their own copy of the same video in the room.' },
] as const;

export function CreateRoom() {
  const { user, loading, login } = useAuth();
  const [name, setName] = useState(rememberedName);
  const [type, setType] = useState<VideoType>('youtube');
  const [urls, setUrls] = useState({ youtube: '', mp4: '', local: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const source = sources.find(item => item.type === type)!;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || loading) return;
    const videoUrl = videoLink(urls[type], type);
    if (!videoUrl) { setError(type === 'youtube' ? 'Enter a link to a specific YouTube video.' : 'Enter a valid HTTPS link to your video.'); return; }
    if (!user && !name.trim()) { setError('Enter your display name.'); return; }
    setBusy(true);
    setError('');
    try {
      const host = user || await login(name);
      const roomId = await runTransaction(db, async tx => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const id = generateRoomId();
          const ref = doc(db, 'rooms', id);
          if ((await tx.get(ref)).exists()) continue;
          const now = Date.now();
          const room: Room = { roomId: id, hostUid: host.uid, hostName: host.displayName, createdAt: now, videoType: type, videoUrl, playing: false, currentTime: 0, playbackRate: 1, lastUpdate: now };
          tx.set(ref, room);
          return id;
        }
        throw new Error('Room code unavailable');
      });
      navigate('/room/' + roomId, { replace: true });
    } catch {
      setError('Could not create the room. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return <div className="setup-wrap">
    <Link className="back-link" to="/"><MdArrowBack /> Back to lobby</Link>
    <section className="panel form-panel">
      <span className="card-icon"><MdMovieCreation /></span>
      <h1>Create a room</h1><p>Choose what everyone will watch.</p>
      <form className="stack" onSubmit={create}>
        {!user && <label>Your display name<input value={name} onChange={e => setName(e.target.value)} maxLength={40} required autoComplete="nickname" placeholder="Name in the room" /></label>}
        <fieldset><legend>Video source</legend><div className="source-options">
          {sources.map(item => <label key={item.type} className="source-option">
            <input className="visually-hidden" type="radio" name="source" checked={item.type === type} onChange={() => { setType(item.type); setError(''); }} />
            <item.icon />{item.name}
          </label>)}
        </div></fieldset>
        <label>{source.label}<input value={urls[type]} onChange={e => { setUrls({ ...urls, [type]: e.target.value }); setError(''); }} required placeholder={type === 'youtube' ? 'https://youtu.be/…' : 'https://…'} inputMode="url" autoComplete="off" spellCheck={false} aria-describedby="source-hint" /><small id="source-hint">{source.hint}</small></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || loading}>{busy ? 'Creating room…' : 'Create room'}</button>
      </form>
    </section>
  </div>;
}

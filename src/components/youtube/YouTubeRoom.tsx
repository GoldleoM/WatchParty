import { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Reaction, Room, User } from '../../types';
import { Screen } from '../video/Screen';
import { Browse, ClipList } from './Browse';
import { clip, watchUrl, type Clip } from './catalog';

interface Entry extends Clip { by: string; priority: number }
interface Props { room: Room; user: User; joined: boolean; reactions: Reaction[]; onBuffer: (b: boolean) => void }

export function YouTubeRoom({ room, user, joined, reactions, onBuffer }: Props) {
  const host = user.uid === room.hostUid;
  const shorts = room.youtubeMode === 'shorts';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [shelf, setShelf] = useState<Clip[]>([]);
  const [notice, setNotice] = useState('');
  const [installed, setInstalled] = useState(false);
  const [native, setNative] = useState(false);
  const session = useRef('');
  const serial = useRef(Promise.resolve());
  const playRequest = useRef(0);
  const ref = doc(db, 'rooms', room.roomId);
  const browseRef = doc(ref, 'youtube', 'browse');
  const queueRef = collection(ref, 'queue');
  useEffect(() => {
    if (!joined) return;
    const roomRef = doc(db, 'rooms', room.roomId);
    const stopQueue = onSnapshot(query(collection(roomRef, 'queue'), orderBy('createdAt'), limit(100)), snap => {
      const items: Entry[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const video = clip(data);
        if (video) items.push({ ...video, by: String(data.by || ''), priority: data.priority?.toMillis?.() || 0 });
      }
      setEntries(items.sort((a,b) => b.priority - a.priority));
    }, () => setNotice('Could not load the queue.'));
    const stopShelf = onSnapshot(doc(roomRef, 'youtube', 'browse'), snap => {
      const list = snap.data()?.videos;
      setShelf(Array.isArray(list) ? list.map(clip).filter((v): v is Clip => !!v) : []);
    }, () => setNotice('Could not load shared videos.'));
    return () => { stopQueue(); stopShelf(); };
  }, [room.roomId, joined]);
  function detach() {
    if (session.current) window.postMessage({ source: 'watchparty-room', kind: 'stop', session: session.current }, location.origin);
    session.current = ''; setNative(false);
  }
  useEffect(() => {
    return () => {
      if (session.current) window.postMessage({ source: 'watchparty-room', kind: 'stop', session: session.current }, location.origin);
      session.current = '';
    };
  }, [room.hostUid]);
  useEffect(() => { setNative(false); }, [room.hostUid]);

  async function add(c: Clip) {
    const entry = doc(queueRef, c.id);
    const added = await runTransaction(db, async tx => {
      if ((await tx.get(entry)).exists()) return false;
      tx.set(entry, { ...c, uid: user.uid, by: user.displayName, createdAt: serverTimestamp() });
      return true;
    });
    setNotice(added ? 'Added to the room queue.' : 'Already in the room queue.');
  }
  async function play(c: Clip, consume: boolean, automatic = false) {
    if (!host) return;
    detach();
    const revision = room.selectionId;
    const request = ++playRequest.current;
    await runTransaction(db, async tx => {
      const latest = (await tx.get(ref)).data();
      if (latest?.hostUid !== user.uid || (automatic && latest.selectionId !== revision)) return;
      const entry = doc(queueRef, c.id);
      const queued = (await tx.get(entry)).exists();
      if (request !== playRequest.current || (consume && !queued)) return;
      tx.update(ref, { videoUrl: watchUrl(c.id), videoTitle: c.title, youtubeMode: c.short ? 'shorts' : 'videos',
        selectionId: crypto.randomUUID(), playing: true, currentTime: 0, playbackRate: 1, lastUpdate: Date.now() });
      if (queued) tx.delete(entry);
    });
  }
  function share(videos: Clip[]) { return setDoc(browseRef, { videos: videos.slice(0,12) }); }
  const handle = (work: Promise<unknown>) => { void work.catch(() => setNotice('Room update failed. Check your connection and host status.')); };
  async function receive(msg: Record<string, unknown>) {
    if (!joined || !session.current || msg.session !== session.current) return false;
    if (msg.kind === 'open-error') { detach(); setNotice('The YouTube companion could not open a tab.'); return false; }
    if (msg.kind === 'away') { setNative(false); return true; }
    const c = clip(msg.video);
    if (msg.kind === 'queue' && c) { await add(c); return true; }
    if (!host) return false;
    if (msg.kind === 'shelf' && Array.isArray(msg.videos)) {
      await share(msg.videos.slice(0,12).map(clip).filter((v): v is Clip => !!v)); return true;
    }
    if (msg.kind !== 'media' || !c || typeof msg.playing !== 'boolean' || typeof msg.rate !== 'number' ||
      typeof msg.time !== 'number' || !Number.isFinite(msg.time) || msg.time < 0 || !(msg.rate > 0 && msg.rate <= 16)) return false;
    setNative(true);
    await runTransaction(db, async tx => {
      const latest = (await tx.get(ref)).data();
      if (latest?.hostUid !== user.uid || msg.session !== session.current) return;
      const videoUrl = watchUrl(c.id);
      tx.update(ref, { videoUrl, videoTitle: c.title, youtubeMode: c.short ? 'shorts' : 'videos',
        selectionId: latest.videoUrl === videoUrl && latest.selectionId ? latest.selectionId : crypto.randomUUID(),
        playing: msg.playing, currentTime: msg.time, playbackRate: msg.rate, lastUpdate: Date.now() });
    });
    return true;
  }
  const receiver = useRef(receive);
  useEffect(() => { receiver.current = receive; });
  useEffect(() => {
    function message(event: MessageEvent) {
      const msg = event.data;
      if (event.source !== window || event.origin !== location.origin || msg?.source !== 'watchparty-companion') return;
      if (msg.kind === 'installed') { setInstalled(true); return; }
      serial.current = serial.current.then(async () => {
        let ok = false;
        try { ok = await receiver.current(msg); } catch { setNotice('Could not sync the YouTube tab.'); }
        window.postMessage({ source: 'watchparty-room', kind: 'reply', request: msg.request, ok }, location.origin);
      });
    }
    window.addEventListener('message', message);
    window.postMessage({ source: 'watchparty-room', kind: 'ping' }, location.origin);
    return () => window.removeEventListener('message', message);
  }, []);
  function openNative() {
    detach();
    session.current = crypto.randomUUID();
    window.postMessage({ source: 'watchparty-room', kind: 'open', session: session.current, share: host, shorts }, location.origin);
  }
  const next = entries[0];
  const playNext = () => { if (next) handle(play(next,true)); };
  return <div className={'yt-room' + (shorts ? ' shorts-mode' : '')}>
    <div className="yt-toolbar"><strong>{shorts ? 'YouTube Shorts' : 'YouTube'}</strong>
      {host && <button className="text-button" onClick={() => { detach(); handle(updateDoc(ref, { youtubeMode: shorts ? 'videos' : 'shorts' })); }}>Switch to {shorts ? 'videos' : 'Shorts'}</button>}</div>
    {native && host ? <div className="local-prompt"><h2>Sharing from YouTube</h2><p>{room.videoTitle}</p><button className="btn secondary" onClick={detach}>Return playback here</button></div> :
      room.videoUrl ? <Screen key={(room.selectionId || room.videoUrl) + host} host={host} room={room} url={room.videoUrl} reactions={reactions} onBuffer={onBuffer} onEnded={host && next ? () => handle(play(next,true,true)) : undefined} /> :
      <div className="local-prompt"><h2>Pick the first {shorts ? 'Short' : 'video'}</h2><p>Everyone can queue videos. The host starts playback.</p></div>}
    <section className="yt-section"><div className="yt-toolbar"><h2>Room queue</h2>
      {host && next && <button className="btn secondary" onClick={playNext}>Play next</button>}</div>
      {entries.length === 0 && <p>The queue is empty.</p>}
      <ol className="yt-queue">{entries.map(c => <li key={c.id}><div><b>{c.title}</b><small>Added by {c.by}</small></div>
        {host && <div className="clip-actions"><button onClick={() => handle(play(c,true))}>Play</button>
          {c !== next && <button onClick={() => handle(updateDoc(doc(queueRef,c.id),{ priority: serverTimestamp() }))}>Move to front</button>}
          <button onClick={() => handle(deleteDoc(doc(queueRef,c.id)))}>Remove</button></div>}</li>)}</ol>
    </section>
    {joined && <><Browse key={String(shorts)} host={host} shorts={shorts} add={c => handle(add(c))} play={c => handle(play(c,false))} share={cs => handle(share(cs).then(() => setNotice('Videos shared with the room.')))} />
      {shelf.length > 0 && <section className="yt-section"><h2>On the host’s screen</h2><ClipList videos={shelf} host={host} add={c => handle(add(c))} play={c => handle(play(c,false))} /></section>}
      <section className="yt-section"><h2>Browse on youtube.com</h2><p>{host ? 'Share visible video titles and playback from a dedicated YouTube tab. Scroll the Shorts feed to change the video for everyone.' : 'Browse your signed-in YouTube feed privately and add videos to the room queue.'}</p>
        {installed ? <button className="btn secondary" onClick={openNative}>{host ? 'Open shared YouTube tab' : 'Open queueing tab'}</button> :
          <details><summary>Set up the desktop companion</summary><p>Download and unzip the companion. Open Chrome or Edge’s extensions page, enable Developer mode, choose Load unpacked, and select the extracted folder. Refresh this room.</p><a className="btn secondary" download href="/watchparty-youtube.zip">Download companion</a></details>}</section></>}
    <p className="yt-notice" role="status">{notice}</p>
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { MdPlayArrow, MdRefresh } from 'react-icons/md';

export function LivePlayer({ url, name }: { url: string; name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'play' | 'playing' | 'paused' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = video.current!;
    let active = true;
    let hls: Hls | undefined;
    let timer: ReturnType<typeof setTimeout>;
    function fail() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      hls?.destroy();
      setStatus('error');
    }
    function loading() {
      if (!active) return;
      setStatus('loading');
      clearTimeout(timer);
      timer = setTimeout(fail, 22000);
    }
    function playing() {
      if (active) { clearTimeout(timer); setStatus('playing'); }
    }
    function paused() {
      if (active) { clearTimeout(timer); setStatus('paused'); }
    }
    function start() {
      if (!active) return;
      void element.play().catch((error: DOMException) => {
        if (!active || error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') { clearTimeout(timer); setStatus('play'); }
        else fail();
      });
    }
    element.addEventListener('playing', playing);
    element.addEventListener('pause', paused);
    element.addEventListener('waiting', loading);
    element.addEventListener('error', fail);
    loading();
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.addEventListener('loadedmetadata', start, { once: true });
      element.src = url;
    } else {
      void import('hls.js/light').then(({ default: Player }) => {
        if (!active) return;
        if (!Player.isSupported()) { fail(); return; }
        hls = new Player({ capLevelToPlayerSize: true });
        hls.on(Player.Events.ERROR, (_, data) => { if (data.fatal) fail(); });
        hls.on(Player.Events.MANIFEST_PARSED, start);
        hls.loadSource(url);
        hls.attachMedia(element);
      }).catch(fail);
    }
    return () => {
      active = false;
      clearTimeout(timer);
      element.removeEventListener('loadedmetadata', start);
      element.removeEventListener('playing', playing);
      element.removeEventListener('pause', paused);
      element.removeEventListener('waiting', loading);
      element.removeEventListener('error', fail);
      hls?.destroy();
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [url, attempt]);
  return <div className="live-screen">
    <video ref={video} controls playsInline aria-label={name + ' live broadcast'} />
    {status === 'loading' && <span className="tuning" role="status">Connecting to {name}…</span>}
    {status === 'play' && <div className="channel-overlay"><button className="btn primary" onClick={() => {
      void video.current?.play().catch(() => setStatus('error'));
    }}><MdPlayArrow /> Play channel</button></div>}
    {status === 'error' && <div className="channel-overlay"><h2>Broadcast unavailable</h2>
      <p role="status">{name} couldn’t load here. Try again or choose another channel.</p>
      <button className="btn secondary" onClick={() => setAttempt(n => n + 1)}><MdRefresh /> Retry channel</button></div>}
  </div>;
}

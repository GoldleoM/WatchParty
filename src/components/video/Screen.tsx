import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MdClosedCaption, MdFullscreen, MdPause, MdPlayArrow, MdVolumeOff, MdVolumeUp } from 'react-icons/md';
import type { Reaction, Room } from '../../types';
import { parseSubtitles, type SubtitleCue } from '../../utils/subtitles';
import { useVideoSync } from '../../hooks/useVideoSync';
import { HTML5Player } from './HTML5Player';
import { YouTubePlayer } from './YouTubePlayer';
import { SubtitleOverlay } from './SubtitleOverlay';
import type { MediaControls } from './player';

interface Props {
  onEnded?: () => void;
  room: Room;
  host: boolean;
  url: string;
  onBuffer: (buffering: boolean) => void;
  reactions: Reaction[];
}

export function Screen({ room, host, url, onBuffer, reactions, onEnded }: Props) {
  const [media, setMedia] = useState<MediaControls | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failure, setFailure] = useState('');
  const [load, setLoad] = useState(0);
  const [notice, setNotice] = useState('');
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [clock, setClock] = useState(0);
  const [captionName, setCaptionName] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const { publish, resync, error } = useVideoSync(room, host, media);
  const Player = room.videoType === 'youtube' ? YouTubePlayer : HTML5Player;
  useEffect(() => {
    if (!media || !cues.length) return;
    setClock(media.time());
    const timer = window.setInterval(() => setClock(media.time()), 200);
    return () => clearInterval(timer);
  }, [media, cues]);

  async function captions(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) { setNotice('Choose a subtitle file smaller than 2 MB.'); return; }
      const parsed = parseSubtitles(await file.text());
      if (!parsed.length) { setNotice('No timed captions found. Choose an SRT or WebVTT file.'); return; }
      setCues(parsed);
      setCaptionName(file.name);
      setNotice('');
    } catch { setNotice('Could not read the subtitle file.'); }
  }
  const fullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch { setNotice('Fullscreen is unavailable in this browser.'); }
  }, []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!media || failure || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a, select, video, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'f' && document.fullscreenEnabled) {
        event.preventDefault();
        void fullscreen();
      } else if (host && event.key === ' ') {
        event.preventDefault();
        if (media.playing()) media.pause(); else media.play();
      } else if (host && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        media.seek(Math.max(0, Math.min(media.duration(), media.time() + (event.key === 'ArrowRight' ? 5 : -5))));
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [media, host, fullscreen, failure]);
  return <>
    <div className="screen-wrap" ref={frame}>
      <div className="screen">
        <Player key={load} url={url} host={host} onEnded={onEnded} onReady={setMedia} onChange={() => {
          if (media?.playing()) setBlocked(false);
          if (host) publish();
        }} onBuffer={onBuffer} onBlocked={() => setBlocked(true)} onError={setFailure} />
        {failure ? <div className="screen-prompt"><p role="alert">{failure}</p>
          <button className="btn secondary" onClick={() => { setMedia(null); setFailure(''); setBlocked(false); setMuted(false); setLoad(load + 1); }}>Retry video</button></div> :
          blocked && room.playing && <div className="screen-prompt"><button className="btn primary" onClick={resync}><MdPlayArrow /> Enable playback</button></div>}
        <SubtitleOverlay cues={cues} currentTime={clock} />
        <div className="floating-reactions" aria-hidden="true">{reactions.map(r => <span key={r.id}>{r.emoji}</span>)}</div>
      </div>
      <div className="playbar">
        {host ? <button className="btn secondary" disabled={!media || !!failure} onClick={() => media?.playing() ? media.pause() : media?.play()}>
          {room.playing ? <MdPause /> : <MdPlayArrow />}{room.playing ? 'Pause' : 'Play'}</button> :
          <span className="play-status">{room.playing ? 'Playing in sync' : 'Paused by host'}</span>}
        <div className="play-tools">
          {!host && room.videoType !== 'youtube' && <button aria-label={muted ? 'Unmute video' : 'Mute video'} disabled={!media} onClick={() => { media?.mute(!muted); setMuted(!muted); }}>{muted ? <MdVolumeOff /> : <MdVolumeUp />}</button>}
          <label className="file-control" title="Load subtitles"><input type="file" accept=".srt,.vtt" className="visually-hidden" aria-label="Load subtitles" onChange={captions} /><MdClosedCaption /></label>
          {document.fullscreenEnabled && <button aria-label="Toggle fullscreen" onClick={fullscreen}><MdFullscreen /></button>}
        </div>
      </div>
    </div>
    {room.videoType === 'youtube' && !failure && <p className="quality-hint">Choose your video quality in the YouTube player under Settings → Quality.</p>}
    {captionName && <div className="file-info"><span>Subtitles · {captionName}</span><button className="text-button" onClick={() => { setCues([]); setCaptionName(''); }}>Remove</button></div>}
    {(notice || error) && <p className="error" role="alert">{notice || error}</p>}
  </>;
}

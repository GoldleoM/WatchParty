import type { PlayerProps } from './player';

export function HTML5Player({ url, host, onReady, onChange, onBuffer, onBlocked, onError }: PlayerProps) {
  return <video src={url} controls={host} playsInline preload="metadata" aria-label="Room video"
    onLoadedMetadata={event => {
      const video = event.currentTarget;
      onReady({
        time: () => video.currentTime, duration: () => video.duration,
        playing: () => !video.paused && !video.ended, rate: () => video.playbackRate,
        setRate: rate => { video.playbackRate = rate; },
        seek: time => { video.currentTime = time; },
        play: () => { void video.play().catch((err: DOMException) => {
          if (err.name === 'NotAllowedError') onBlocked();
          else if (err.name !== 'AbortError') onError('Your browser could not play this video.');
        }); },
        pause: () => video.pause(), mute: muted => { video.muted = muted; },
      });
    }}
    onPlay={onChange} onPause={onChange} onEnded={onChange} onSeeked={onChange} onRateChange={onChange}
    onPlaying={() => onBuffer(false)} onWaiting={() => onBuffer(true)}
    onError={() => onError('This video could not be loaded. Check the file format or source link.')}
  />;
}

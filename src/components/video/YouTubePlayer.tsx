import { useEffect, useLayoutEffect, useRef } from 'react';
import { youtubeId } from '../../utils/links';
import type { PlayerProps } from './player';

interface EmbeddedPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  seekTo(time: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface PlayerOptions {
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onPlaybackRateChange: () => void;
    onAutoplayBlocked: () => void;
    onError: () => void;
  };
}
type Api = { Player: new (node: HTMLElement, options: PlayerOptions) => EmbeddedPlayer };
const yt = window as Window & { YT?: Api; onYouTubeIframeAPIReady?: () => void };
let loading: Promise<Api> | undefined;
function loadApi() {
  if (yt.YT?.Player) return Promise.resolve(yt.YT);
  if (loading) return loading;
  loading = new Promise<Api>((resolve, reject) => {
    const script = document.createElement('script');
    function fail() {
      clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(new Error('YouTube did not respond'));
    }
    const timeout = window.setTimeout(fail, 15000);
    yt.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (yt.YT?.Player) resolve(yt.YT); else fail();
    };
    script.onerror = fail;
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
  return loading;
}

export function YouTubePlayer(props: PlayerProps) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const { url, host } = props;
  useEffect(() => {
    let active = true;
    let player: EmbeddedPlayer | undefined;
    const failure = () => { if (active) latest.current.onError('YouTube could not load this video. It may be private or unavailable for embedding.'); };
    const timeout = window.setTimeout(failure, 20000);
    loadApi().then(api => {
      if (!active || !container.current) return;
      const id = youtubeId(url);
      if (!id) { failure(); return; }
      const mount = document.createElement('div');
      container.current.replaceChildren(mount);
      player = new api.Player(mount, {
        videoId: id,
        playerVars: { origin: window.location.origin, controls: host ? 1 : 0, disablekb: host ? 0 : 1, playsinline: 1, rel: 0 },
        events: {
          onReady() {
            clearTimeout(timeout);
            const p = player;
            if (!active || !p) return;
            p.getIframe().title = 'YouTube room video';
            if (!host) p.getIframe().tabIndex = -1;
            latest.current.onReady({
              time: () => p.getCurrentTime(), duration: () => p.getDuration(),
              playing: () => [1, 3].includes(p.getPlayerState()), rate: () => p.getPlaybackRate(),
              setRate: rate => p.setPlaybackRate(rate), seek: time => p.seekTo(time, true),
              play: () => p.playVideo(), pause: () => p.pauseVideo(), mute: muted => muted ? p.mute() : p.unMute(),
            });
          },
          onStateChange({ data }) {
            if (!active) return;
            if ([0, 1, 2].includes(data)) latest.current.onChange();
            if (data === 0) latest.current.onEnded?.();
            if ([1, 2, 3].includes(data)) latest.current.onBuffer(data === 3);
          },
          onPlaybackRateChange: () => { if (active) latest.current.onChange(); },
          onAutoplayBlocked: () => { if (active) latest.current.onBlocked(); },
          onError: failure,
        },
      });
    }).catch(failure);
    return () => { active = false; clearTimeout(timeout); player?.destroy(); };
  }, [url, host]);
  return <div className={'youtube' + (host ? '' : ' guest-player')} ref={container} />;
}

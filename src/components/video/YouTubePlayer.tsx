import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

interface YouTubePlayerProps {
  url: string;
  playing: boolean;
  playbackRate: number;
  onTimeUpdate?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
  className?: string;
  registerMethods?: (methods: {
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    setPlaybackRate: (rate: number) => void;
    play: () => void;
    pause: () => void;
  }) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  url,
  playing,
  playbackRate,
  onTimeUpdate,
  onPlay,
  onPause,
  onBuffering,
  className,
  registerMethods,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const timeUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    // Load YouTube IFrame API script if it doesn't exist
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!containerRef.current) return;
      
      const videoId = extractVideoId(url);
      if (!videoId) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: playing ? 1 : 0,
          controls: 1,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            if (playing) event.target.playVideo();
            event.target.setPlaybackRate(playbackRate);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              onPlay?.();
              onBuffering?.(false);
              
              // Start time update interval
              if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
              timeUpdateInterval.current = setInterval(() => {
                if (playerRef.current?.getCurrentTime && onTimeUpdate) {
                  onTimeUpdate(playerRef.current.getCurrentTime());
                }
              }, 1000);

            } else if (event.data === window.YT.PlayerState.PAUSED) {
              onPause?.();
              if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              onBuffering?.(true);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              onPause?.();
              if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }

    return () => {
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [url]); // Re-init if URL changes

  useEffect(() => {
    if (registerMethods && isReady) {
      registerMethods({
        getCurrentTime: () => playerRef.current?.getCurrentTime?.() || 0,
        seekTo: (time: number) => {
          playerRef.current?.seekTo?.(time, true);
        },
        setPlaybackRate: (rate: number) => {
          playerRef.current?.setPlaybackRate?.(rate);
        },
        play: () => {
          playerRef.current?.playVideo?.();
        },
        pause: () => {
          playerRef.current?.pauseVideo?.();
        }
      });
    }
  }, [registerMethods, isReady]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    // YouTube's API state integers: 1 = playing, 2 = paused
    const state = playerRef.current.getPlayerState?.();
    if (playing && state !== 1) {
      playerRef.current.playVideo?.();
    } else if (!playing && state === 1) {
      playerRef.current.pauseVideo?.();
    }
  }, [playing, isReady]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    playerRef.current.setPlaybackRate?.(playbackRate);
  }, [playbackRate, isReady]);

  return (
    <div className={cn('w-full h-full bg-black relative', className)}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface HTML5PlayerProps {
  url: string;
  playing: boolean;
  playbackRate: number;
  onTimeUpdate?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: (time: number) => void;
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

export const HTML5Player: React.FC<HTML5PlayerProps> = ({
  url,
  playing,
  playbackRate,
  onTimeUpdate,
  onPlay,
  onPause,
  onSeeked,
  onBuffering,
  className,
  registerMethods,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // internalPlaying removed

  useEffect(() => {
    if (registerMethods && videoRef.current) {
      registerMethods({
        getCurrentTime: () => videoRef.current?.currentTime || 0,
        seekTo: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },
        setPlaybackRate: (rate: number) => {
          if (videoRef.current) {
            videoRef.current.playbackRate = rate;
          }
        },
        play: () => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
          }
        },
        pause: () => {
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      });
    }
  }, [registerMethods]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (playing && videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
    } else if (!playing && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [playing]);

  useEffect(() => {
    if (videoRef.current && videoRef.current.playbackRate !== playbackRate) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!videoRef.current) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 5,
            videoRef.current.duration || 0
          );
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - 5,
            0
          );
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
          } else {
            videoRef.current.pause();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.error);
          } else {
            videoRef.current.requestFullscreen().catch(console.error);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          videoRef.current.volume = Math.min(videoRef.current.volume + 0.1, 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          videoRef.current.volume = Math.max(videoRef.current.volume - 0.1, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  return (
    <video
      ref={videoRef}
      src={url}
      className={cn('w-full h-full bg-black outline-none', className)}
      controls
      onTimeUpdate={handleTimeUpdate}
      onPlay={() => {
        onPlay?.();
      }}
      onPause={() => {
        onPause?.();
      }}
      onWaiting={() => onBuffering?.(true)}
      onPlaying={() => onBuffering?.(false)}
      onSeeked={() => {
        if (onSeeked && videoRef.current) {
          onSeeked(videoRef.current.currentTime);
        }
      }}
    />
  );
};

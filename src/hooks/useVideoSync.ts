import { useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Room } from '../types';

interface SyncOptions {
  isHost: boolean;
  roomId: string | undefined;
  room: Room | null;
  getCurrentTime: () => number;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  play: () => void;
  pause: () => void;
  updateStatus?: (status: 'watching' | 'buffering') => void;
}

export const useVideoSync = ({
  isHost,
  roomId,
  room,
  getCurrentTime,
  seekTo,
  setPlaybackRate,
  play,
  pause,
  updateStatus,
}: SyncOptions) => {
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSeekingRef = useRef(false);

  // For host to emit sync events
  const emitSync = useCallback(async (playing: boolean, time: number) => {
    if (!isHost || !roomId) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        playing,
        currentTime: time,
        lastUpdate: Date.now(),
      });
    } catch (e) {
      console.error('Failed to sync', e);
    }
  }, [isHost, roomId]);

  // Host: periodically sync current time if playing
  useEffect(() => {
    if (!isHost || !roomId || !room?.playing) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      return;
    }

    syncIntervalRef.current = setInterval(() => {
      emitSync(true, getCurrentTime());
    }, 3000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isHost, roomId, room?.playing, emitSync, getCurrentTime]);

  // Clients: listen to room changes and apply sync
  useEffect(() => {
    if (isHost || !room) return;

    if (isSeekingRef.current) return; // Prevent loop

    const localTime = getCurrentTime();
    
    // Calculate expected time
    // If playing, expected time is currentTime from db + time elapsed since lastUpdate
    let expectedTime = room.currentTime;
    if (room.playing) {
      const elapsedSeconds = (Date.now() - room.lastUpdate) / 1000;
      expectedTime += elapsedSeconds;
    }

    const drift = Math.abs(expectedTime - localTime);

    // Play/Pause sync
    if (room.playing) {
      play();
    } else {
      pause();
      // If paused, we should strictly match the time
      if (drift > 0.5) {
        seekTo(expectedTime);
      }
      return; // No drift correction when paused
    }

    // Drift correction
    if (drift > 1.0) {
      // Large drift: seek immediately
      isSeekingRef.current = true;
      updateStatus?.('buffering');
      seekTo(expectedTime);
      
      // Allow a moment for the seek to process before accepting new syncs
      setTimeout(() => {
        isSeekingRef.current = false;
        updateStatus?.('watching');
      }, 500);
      setPlaybackRate(1); // Reset rate
    } else if (drift > 0.3) {
      // Small drift: adjust playback rate smoothly
      const speedUp = expectedTime > localTime;
      setPlaybackRate(speedUp ? 1.05 : 0.95);
    } else {
      // In sync
      setPlaybackRate(1);
    }

  }, [room?.currentTime, room?.playing, room?.lastUpdate, isHost]); 
  // We explicitly depend on specific room fields instead of the whole room object
  // to avoid infinite loops if other fields update

  return { emitSync };
};

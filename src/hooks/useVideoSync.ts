import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import type { Room } from '../types';
import type { MediaControls } from '../components/video/player';
import { db } from '../firebase/config';

type LocalPlayback = { media: MediaControls; mode: 'buffering' | 'behind' | 'joining' };
const syncTolerance = 0.85;

function groupTime(media: MediaControls, room: Room) {
  const elapsed = room.playing ? Math.max(0, Date.now() - room.lastUpdate) / 1000 : 0;
  return Math.min(media.duration() || Infinity, room.currentTime + elapsed * room.playbackRate);
}

function followRoom(media: MediaControls, room: Room, syncPosition: boolean) {
  const target = groupTime(media, room);
  if (syncPosition && Math.abs(media.time() - target) > (room.playing ? syncTolerance : 0.15)) media.seek(target);
  if (media.rate() !== room.playbackRate) media.setRate(room.playbackRate);
  const atEnd = media.duration() > 0 && target >= media.duration();
  const shouldPlay = atEnd ? !syncPosition && media.time() < target : room.playing;
  if (shouldPlay && !media.playing()) media.play();
  if (!shouldPlay && media.playing()) media.pause();
}

export function useVideoSync(room: Room, host: boolean, media: MediaControls | null) {
  const [error, setError] = useState('');
  const initialized = useRef<MediaControls | null>(null);
  // Player events can arrive together before React renders the new status.
  const local = useRef<LocalPlayback | null>(null);
  const [localPlayback, setLocalPlayback] = useState<LocalPlayback | null>(null);
  const away = localPlayback?.media === media;
  function setLocal(value: LocalPlayback | null) {
    local.current = value;
    setLocalPlayback(value);
  }
  const followsGroup = useCallback(() => !local.current || local.current.media !== media, [media]);
  const { roomId, selectionId } = room;
  const writePlayback = useCallback((playing: boolean, currentTime: number, playbackRate: number) => {
    if (!host) return;
    const ref = doc(db, 'rooms', roomId);
    const state = {
      playing, currentTime, playbackRate, lastUpdate: Date.now(),
    };
    const write = room.videoType === 'youtube' ? runTransaction(db, async tx => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists() && !snapshot.data().closed && snapshot.data().selectionId === selectionId) tx.update(ref, state);
    }) : updateDoc(ref, state);
    void write.then(() => setError('')).catch(() => setError('Playback could not sync. Check your connection.'));
  }, [host, roomId, room.videoType, selectionId]);

  const publish = useCallback(() => {
    if (!media || !followsGroup()) return;
    writePlayback(media.playing(), media.time(), media.rate());
  }, [media, followsGroup, writePlayback]);

  function buffered(waiting: boolean) {
    if (!media) return;
    if (waiting) {
      if (room.playing && followsGroup()) {
        setLocal({ media, mode: 'buffering' });
      }
    } else if (local.current?.media === media && local.current.mode === 'buffering') {
      setLocal(Math.abs(groupTime(media, room) - media.time()) > syncTolerance ? { media, mode: 'behind' } : null);
    }
  }

  useEffect(() => {
    if (!media) return;
    if (!host || initialized.current !== media || !followsGroup()) followRoom(media, room, followsGroup());
    initialized.current = media;
    if (!host && room.videoType === 'youtube') {
      // The native quality menu also exposes timeline controls, including seeking while paused.
      const timer = window.setInterval(() => {
        if (!room.playing || !media.buffering?.()) followRoom(media, room, followsGroup());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [media, room, host, followsGroup]);
  useEffect(() => {
    if (!media || !host) return;
    // YouTube has no seek event. Check its clock even while paused.
    const timer = window.setInterval(() => {
      if (!followsGroup() && room.playing && media.duration() > 0 && groupTime(media, room) >= media.duration()) {
        writePlayback(false, media.duration(), room.playbackRate);
        return;
      }
      if (media.playing() || Math.abs(media.time() - room.currentTime) > 0.3) publish();
    }, 4000);
    return () => clearInterval(timer);
  }, [media, host, publish, room, followsGroup, writePlayback]);
  const resync = () => {
    if (media) followRoom(media, room, followsGroup());
  };
  function jumpToGroup() {
    if (!media || !local.current) return;
    setLocal({ media, mode: 'joining' });
    followRoom(media, room, true);
  }
  useEffect(() => {
    if (!media || localPlayback?.media !== media || localPlayback.mode !== 'joining') return;
    const timer = window.setInterval(() => {
      if (local.current?.mode !== 'joining') return;
      if (!media.buffering?.()) {
        setLocal(Math.abs(groupTime(media, room) - media.time()) <= syncTolerance ? null : { media, mode: 'behind' });
      }
    }, 200);
    return () => clearInterval(timer);
  }, [localPlayback, media, room]);
  const togglePlayback = useCallback(() => {
    if (!media) return;
    if (!followsGroup()) writePlayback(!room.playing, groupTime(media, room), room.playbackRate);
    else if (media.playing()) media.pause();
    else media.play();
  }, [media, followsGroup, writePlayback, room]);
  return { publish, error, resync, buffered, away, jumpToGroup, togglePlayback };
}

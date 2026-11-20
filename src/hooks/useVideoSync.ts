import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import type { Room } from '../types';
import type { MediaControls } from '../components/video/player';
import { db } from '../firebase/config';

function followRoom(media: MediaControls, room: Room) {
  const elapsed = room.playing ? Math.max(0, Date.now() - room.lastUpdate) / 1000 : 0;
  const target = Math.min(media.duration() || Infinity, room.currentTime + elapsed * room.playbackRate);
  if (Math.abs(media.time() - target) > (room.playing ? 0.85 : 0.15)) media.seek(target);
  if (media.rate() !== room.playbackRate) media.setRate(room.playbackRate);
  if (room.playing && !media.playing()) media.play();
  if (!room.playing && media.playing()) media.pause();
}

export function useVideoSync(room: Room, host: boolean, media: MediaControls | null) {
  const [error, setError] = useState('');
  const initialized = useRef<MediaControls | null>(null);
  const { roomId } = room;
  const publish = useCallback(() => {
    if (!host || !media) return;
    void updateDoc(doc(db, 'rooms', roomId), {
      playing: media.playing(), currentTime: media.time(), playbackRate: media.rate(), lastUpdate: Date.now(),
    }).then(() => setError('')).catch(() => setError('Playback could not sync. Check your connection.'));
  }, [media, host, roomId]);

  useEffect(() => {
    if (!media) return;
    if (!host || initialized.current !== media) followRoom(media, room);
    initialized.current = media;
  }, [media, room, host]);
  useEffect(() => {
    if (!media || !host) return;
    // YouTube has no seek event. Check its clock even while paused.
    const timer = window.setInterval(() => {
      if (media.playing() || Math.abs(media.time() - room.currentTime) > 0.3) publish();
    }, 4000);
    return () => clearInterval(timer);
  }, [media, host, publish, room.currentTime]);
  return { publish, error, resync: () => { if (media) followRoom(media, room); } };
}

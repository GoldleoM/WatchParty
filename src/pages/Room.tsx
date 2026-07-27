import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { motion, AnimatePresence } from 'framer-motion';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { useRoom } from '../hooks/useRoom';
import { usePresence } from '../hooks/usePresence';
import { useVideoSync } from '../hooks/useVideoSync';
import { useAuth } from '../contexts/AuthContext';
import { useReactions } from '../hooks/useReactions';
import { YouTubePlayer } from '../components/video/YouTubePlayer';
import { HTML5Player } from '../components/video/HTML5Player';
import { Sidebar } from '../components/room/Sidebar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { SubtitleCue } from '../utils/subtitles';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const { room, loading: roomLoading, error } = useRoom(roomId, user);
  const { members, updateStatus, toggleReady } = usePresence(roomId, user);
  const { reactions, sendReaction } = useReactions(roomId, user);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  // showReactions removed
  const [displayName, setDisplayName] = useState(localStorage.getItem('syncwatch_displayname') || '');
  const [, setSubtitles] = useState<SubtitleCue[]>([]);

  // Methods passed from player
  const playerMethodsRef = useRef<{
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    setPlaybackRate: (rate: number) => void;
    play: () => void;
    pause: () => void;
  } | null>(null);

  const isHost = user?.uid === room?.hostUid;

  const handleCloseRoom = async () => {
    if (!roomId || !isHost) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      navigate('/');
    } catch (e) {
      console.error('Failed to close room:', e);
    }
  };

  const handleTransferHost = async (newHostUid: string, newHostName: string) => {
    if (!roomId || !isHost) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        hostUid: newHostUid,
        hostName: newHostName,
      });
    } catch (e) {
      console.error('Failed to transfer host:', e);
    }
  };

  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const cleanup = () => {
      // Only delete if we are STILL the host when unmounting or closing the tab
      if (isHostRef.current && roomId) {
        deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [roomId]);

  const { emitSync } = useVideoSync({
    isHost,
    roomId,
    room,
    getCurrentTime: () => playerMethodsRef.current?.getCurrentTime() || 0,
    seekTo: (t) => playerMethodsRef.current?.seekTo(t),
    setPlaybackRate: (r) => playerMethodsRef.current?.setPlaybackRate(r),
    play: () => playerMethodsRef.current?.play(),
    pause: () => playerMethodsRef.current?.pause(),
    updateStatus,
  });

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (isHost) {
            if (room?.playing) emitSync(false, playerMethodsRef.current?.getCurrentTime() || 0);
            else emitSync(true, playerMethodsRef.current?.getCurrentTime() || 0);
          }
          break;
        case 'f':
          handleFullscreenToggle();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, room?.playing, emitSync]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await login(displayName.trim());
  };

  if (!user) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="bg-card p-8 rounded-xl border border-border shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Join Room {roomId}</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              placeholder="Your Display Name" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)}
            />
            <Button type="submit" className="w-full">Join</Button>
          </form>
        </div>
      </div>
    );
  }

  if (roomLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }

  if (error || !room) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Oops!</h2>
        <p className="text-muted-foreground">{error || 'Room not found'}</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const Player = room.videoType === 'youtube' ? YouTubePlayer : HTML5Player;

  const handlePlay = () => {
    updateStatus('watching');
    if (isHost) emitSync(true, playerMethodsRef.current?.getCurrentTime() || 0);
  };

  const handlePause = () => {
    if (isHost) emitSync(false, playerMethodsRef.current?.getCurrentTime() || 0);
  };

  const handleTimeUpdate = () => {
    // We handle host sync emitting in useVideoSync interval
  };

  const readyCount = members.filter(m => m.isReady).length;
  const allReady = members.length > 0 && readyCount === members.length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Main Video Area */}
      <div ref={containerRef} className="flex-1 relative flex flex-col bg-black">
        <div className="flex-1 relative group">
          
          {/* Overlay to block non-host interaction if needed, but we let YT API handle it mostly. 
              Actually, for perfect sync, non-hosts shouldn't seek. 
              A transparent overlay can block clicks for non-hosts. */}
          {room.videoType === 'local' && !localVideoUrl ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/90 text-center p-8 space-y-6">
              <h3 className="text-2xl font-bold text-foreground">Local File Sync</h3>
              <p className="text-muted-foreground max-w-md">
                This room uses local file synchronization to guarantee perfect playback without server buffering. 
                <br /><br />
                <strong>Step 1:</strong> Download the video file from the host's link below:
              </p>
              <a 
                href={room.videoUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-primary font-medium hover:underline break-all max-w-lg"
              >
                {room.videoUrl}
              </a>
              <p className="text-muted-foreground mt-4">
                <strong>Step 2:</strong> Select the downloaded file from your computer:
              </p>
              <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLocalVideoUrl(URL.createObjectURL(file));
                  }
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} size="lg" className="shadow-[0_0_20px_rgba(var(--primary),0.4)]">
                Select Downloaded Video
              </Button>
            </div>
          ) : (
            <>
              {!isHost && (
                <div className="absolute inset-0 z-10 pointer-events-auto cursor-not-allowed opacity-0" title="Only the host can control playback" />
              )}
    
              <Player
                url={localVideoUrl || room.videoUrl}
                playing={room.playing}
            playbackRate={room.playbackRate}
            registerMethods={(methods) => {
              playerMethodsRef.current = methods;
            }}
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={(time) => {
              if (isHost) emitSync(room.playing, time);
            }}
                onBuffering={(b) => updateStatus(b ? 'buffering' : 'watching')}
              />
            </>
          )}

          {/* Controls Overlay (Hover) */}
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="secondary" size="sm" onClick={handleFullscreenToggle} className="bg-black/50 text-white border-none hover:bg-black/70">
              {isFullscreen ? <MdFullscreenExit size={24} /> : <MdFullscreen size={24} />}
            </Button>
          </div>

          {/* Reactions Overlay */}
          <div className="absolute bottom-20 left-10 z-20 pointer-events-none flex items-end">
            <AnimatePresence>
              {reactions.map((reaction) => (
                <motion.div
                  key={reaction.id}
                  initial={{ opacity: 0, y: 50, scale: 0.5 }}
                  animate={{ opacity: 1, y: -Math.random() * 200 - 50, scale: 1.5, x: (Math.random() - 0.5) * 100 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute text-4xl"
                >
                  {reaction.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Start Movie Button for Host */}
          {isHost && !room.playing && allReady && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <Button 
                  size="lg" 
                  className="text-xl px-12 py-6 rounded-full shadow-[0_0_40px_rgba(var(--primary),0.6)] animate-pulse"
                  onClick={() => {
                    emitSync(true, playerMethodsRef.current?.getCurrentTime() || 0);
                    playerMethodsRef.current?.play();
                  }}
                >
                  {room.currentTime > 1 ? 'Resume Movie' : 'Start Movie'}
                </Button>
              </motion.div>
            </div>
          )}
        </div>

        {/* Reaction Bar */}
        <div className="h-16 bg-card border-t border-border flex items-center px-4 gap-2 relative z-20">
          {['😂', '😭', '🔥', '❤️', '👏', '👀', '🤯'].map((emoji) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => sendReaction(emoji)}
              className="w-10 h-10 text-2xl flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
          
          <div className="flex-1" />
          
          {isHost && (
            <div className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
              You are the Host. Space = Play/Pause
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      {!isFullscreen && (
        <Sidebar 
          room={room} 
          members={members} 
          user={user} 
          isHost={isHost}
          onToggleReady={toggleReady} 
          onSubtitlesLoaded={setSubtitles} 
          onCloseRoom={handleCloseRoom}
          onTransferHost={handleTransferHost}
        />
      )}
    </div>
  );
};

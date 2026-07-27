import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdVideoCall } from 'react-icons/md';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { generateRoomId } from '../utils/cn';
import type { Room, VideoType } from '../types';

export const CreateRoom: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [videoType, setVideoType] = useState<VideoType>('youtube');
  const [videoUrl, setVideoUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Redirect to home if not logged in (should be handled by a ProtectedRoute ideally)
  if (!user) {
    navigate('/');
    return null;
  }

  const validateUrl = (url: string, type: VideoType) => {
    if (!url) return false;
    if (type === 'youtube') {
      const ytRegex = /^(https?:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
      return ytRegex.test(url);
    } else {
      return url.startsWith('http');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateUrl(videoUrl, videoType)) {
      setError(`Invalid ${videoType === 'youtube' ? 'YouTube' : 'Direct Video'} URL`);
      return;
    }

    setIsCreating(true);
    try {
      const roomId = generateRoomId();
      
      const newRoom: Room = {
        roomId,
        hostUid: user.uid,
        hostName: user.displayName,
        createdAt: Date.now(),
        videoType,
        videoUrl,
        playing: false,
        currentTime: 0,
        playbackRate: 1,
        lastUpdate: Date.now(),
      };

      await setDoc(doc(db, 'rooms', roomId), newRoom);
      
      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error(err);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-xl"
      >
        <div className="text-center mb-8">
          <MdVideoCall className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Create Room</h1>
          <p className="text-muted-foreground mt-2">Set up your watch party</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Video Source</label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant={videoType === 'youtube' ? 'primary' : 'secondary'}
                onClick={() => setVideoType('youtube')}
              >
                YouTube
              </Button>
              <Button
                type="button"
                variant={videoType === 'mp4' ? 'primary' : 'secondary'}
                onClick={() => setVideoType('mp4')}
              >
                Direct Stream
              </Button>
              <Button
                type="button"
                variant={videoType === 'local' ? 'primary' : 'secondary'}
                onClick={() => setVideoType('local')}
                className="col-span-2"
              >
                Local File Sync (Download Required)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {videoType === 'youtube' && 'YouTube Video URL'}
              {videoType === 'mp4' && 'Direct Video URL'}
              {videoType === 'local' && 'Download Link for Guests'}
            </label>
            <Input
              placeholder={
                videoType === 'youtube' ? 'https://youtube.com/watch?v=...' : 
                videoType === 'local' ? 'https://drive.google.com/file/d/...' :
                'https://example.com/video or any direct stream link'
              }
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>

          <Button 
            type="submit"
            className="w-full h-12 text-lg mt-4"
            disabled={!videoUrl.trim() || isCreating}
            isLoading={isCreating}
          >
            Create & Join Room
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

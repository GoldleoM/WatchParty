import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdPlayCircleOutline, MdGroupAdd } from 'react-icons/md';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { cleanupOldRooms } from '../utils/cleanup';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [displayName, setDisplayName] = useState(localStorage.getItem('syncwatch_displayname') || '');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    // Run garbage collection in the background when someone visits home
    cleanupOldRooms();
  }, []);

  const handleLogin = async () => {
    if (!user && displayName.trim()) {
      await login(displayName.trim());
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      await handleLogin();
      navigate('/create');
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    
    setIsJoining(true);
    try {
      await handleLogin();
      // Extract room code if user pasted a full URL
      let finalCode = roomCode.trim();
      if (finalCode.includes('/room/')) {
        finalCode = finalCode.split('/room/')[1].split('/')[0];
      }
      navigate(`/room/${finalCode}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-br from-primary to-purple-400 bg-clip-text text-transparent mb-2">
            SyncWatch
          </h1>
          <p className="text-muted-foreground">Watch videos together in perfect sync</p>
        </div>

        <div className="space-y-6">
          {!user && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Choose your display name</label>
              <Input
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="pt-2">
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleCreateRoom}
              disabled={!user && !displayName.trim() || isCreating}
              isLoading={isCreating}
            >
              <MdPlayCircleOutline className="w-6 h-6 mr-2" />
              Create Room
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or join existing</span>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Room Code or URL"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
            </div>
            <Button 
              type="submit"
              variant="secondary"
              className="w-full h-12"
              disabled={!roomCode.trim() || (!user && !displayName.trim()) || isJoining}
              isLoading={isJoining}
            >
              <MdGroupAdd className="w-5 h-5 mr-2" />
              Join Room
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

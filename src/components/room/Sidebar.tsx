import React from 'react';
import { MdContentCopy, MdCheckCircle, MdPhoneInTalk, MdClosedCaption } from 'react-icons/md';
import type { Room, RoomMember, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Chat } from './Chat';
import type { SubtitleCue } from '../../utils/subtitles';
import { parseSubtitles } from '../../utils/subtitles';

interface SidebarProps {
  room: Room;
  members: RoomMember[];
  user: User | null;
  isHost: boolean;
  onToggleReady: (currentState: boolean) => void;
  onSubtitlesLoaded: (cues: SubtitleCue[]) => void;
  onCloseRoom: () => void;
  onTransferHost: (uid: string, name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ room, members, user, isHost, onToggleReady, onSubtitlesLoaded, onCloseRoom, onTransferHost }) => {
  const me = members.find(m => m.uid === user?.uid);
  // host const removed as it was unused
  
  const readyCount = members.filter(m => m.isReady).length;
  // allReady const removed as it was unused

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    // Could add a toast here
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const cues = parseSubtitles(content);
      onSubtitlesLoaded(cues);
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  return (
    <div className="w-80 h-full flex flex-col bg-card/80 backdrop-blur-md border-l border-border p-4 gap-4">
      {/* Room Info */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Room {room.roomId}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={copyRoomLink}>
            <MdContentCopy className="mr-2" /> Copy Link
          </Button>
          {isHost && (
            <Button variant="primary" size="sm" className="flex-1 bg-destructive hover:bg-destructive/90" onClick={onCloseRoom}>
              Close Room
            </Button>
          )}
        </div>
        <div className="bg-primary/10 text-primary border border-primary/20 rounded-md p-3 flex items-start gap-3 text-sm">
          <MdPhoneInTalk className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>Don't forget to join the WhatsApp group call to talk with your friends!</p>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Members ({members.length})
          </h3>
          <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full">
            {readyCount}/{members.length} Ready
          </span>
        </div>
        
        <div className="overflow-y-auto space-y-2 mb-4">
          {members.map(member => (
            <div key={member.uid} className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Avatar name={member.displayName} status={member.status} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium flex items-center gap-1">
                    {member.displayName}
                    {member.uid === room.hostUid && <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded uppercase font-bold">Host</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">{member.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isHost && member.uid !== room.hostUid && (
                  <button 
                    onClick={() => onTransferHost(member.uid, member.displayName)}
                    className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors"
                  >
                    👑 Make Host
                  </button>
                )}
                {member.isReady && <MdCheckCircle className="text-green-500 w-5 h-5" />}
              </div>
            </div>
          ))}
        </div>

        {/* Ready Button */}
        {me && (
          <Button 
            variant={me.isReady ? 'secondary' : 'primary'} 
            className="w-full shrink-0 mb-4"
            onClick={() => onToggleReady(me.isReady)}
          >
            {me.isReady ? 'Not Ready' : 'I am Ready!'}
          </Button>
        )}

        {/* Subtitles Upload */}
        <div className="mb-4 bg-background/50 p-3 rounded-lg border border-border">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              <MdClosedCaption className="w-5 h-5 text-primary" />
              Load Local Subtitles
            </div>
            <input 
              type="file" 
              accept=".srt,.vtt" 
              className="hidden" 
              onChange={handleSubtitleUpload}
            />
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
              Upload
            </span>
          </label>
        </div>

        {/* Chat */}
        <div className="flex-1 min-h-0 pb-2">
          <Chat roomId={room.roomId} user={user} />
        </div>
      </div>
    </div>
  );
};

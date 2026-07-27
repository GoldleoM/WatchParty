export type VideoType = 'youtube' | 'mp4' | 'local';

export interface User {
  uid: string;
  displayName: string;
  createdAt: number;
}

export interface RoomMember {
  uid: string;
  displayName: string;
  isReady: boolean;
  status: 'watching' | 'buffering' | 'offline';
  joinedAt: number;
  lastActive: number;
}

export interface Room {
  roomId: string;
  hostUid: string;
  hostName: string;
  createdAt: number;
  videoType: VideoType;
  videoUrl: string;
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  lastUpdate: number;
}

export interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export interface Reaction {
  id: string;
  uid: string;
  emoji: string;
  timestamp: number;
}

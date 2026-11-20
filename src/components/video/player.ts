export interface MediaControls {
  time: () => number;
  duration: () => number;
  playing: () => boolean;
  rate: () => number;
  setRate: (rate: number) => void;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  mute: (muted: boolean) => void;
}
export interface PlayerProps {
  url: string;
  host: boolean;
  onReady: (media: MediaControls) => void;
  onChange: () => void;
  onBuffer: (buffering: boolean) => void;
  onBlocked: () => void;
  onError: (message: string) => void;
}

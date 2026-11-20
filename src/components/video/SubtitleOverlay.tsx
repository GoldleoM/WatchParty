import type { SubtitleCue } from '../../utils/subtitles';

export function SubtitleOverlay({ cues, currentTime }: { cues: SubtitleCue[]; currentTime: number }) {
  const cue = cues.find(c => c.startTime <= currentTime && c.endTime > currentTime);
  return cue ? <div className="captions"><span>{cue.text}</span></div> : null;
}

import React, { useState, useEffect } from 'react';
import type { SubtitleCue } from '../../utils/subtitles';

interface SubtitleOverlayProps {
  cues: SubtitleCue[];
  currentTime: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ cues, currentTime }) => {
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

  useEffect(() => {
    if (!cues || cues.length === 0) {
      setActiveCue(null);
      return;
    }

    // Optimization: binary search could be used if cues are guaranteed sorted,
    // but linear search is usually fast enough for subtitles (e.g. 1000 items)
    const current = cues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );

    setActiveCue(current || null);
  }, [cues, currentTime]);

  if (!activeCue) return null;

  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-30 px-4">
      <div 
        className="bg-black/75 px-4 py-2 rounded-lg max-w-3xl text-center backdrop-blur-sm shadow-xl border border-white/10"
        style={{
          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
        }}
      >
        <p className="text-white text-xl sm:text-2xl font-medium tracking-wide whitespace-pre-wrap">
          {activeCue.text}
        </p>
      </div>
    </div>
  );
};

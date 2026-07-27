export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

const parseTime = (timeStr: string): number => {
  // Handles both SRT (00:00:00,000) and VTT (00:00:00.000)
  const [hms, ms] = timeStr.replace(',', '.').split('.');
  const parts = hms.split(':').map(Number);
  
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  } else if (parts.length === 2) {
    [minutes, seconds] = parts;
  }
  
  return (hours * 3600) + (minutes * 60) + seconds + (Number(ms) / 1000);
};

export const parseSubtitles = (fileContent: string): SubtitleCue[] => {
  const blocks = fileContent.replace(/\r\n/g, '\n').split('\n\n');
  
  const cues: SubtitleCue[] = [];
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    
    // VTT files often have "WEBVTT" as the first block or metadata blocks
    if (lines[0].includes('WEBVTT') || lines[0].includes('Kind:') || lines[0].includes('Language:')) continue;
    
    let timeLineIndex = 0;
    let id = '';
    
    // Check if the first line is an ID (no '-->')
    if (!lines[0].includes('-->')) {
      id = lines[0];
      timeLineIndex = 1;
    }
    
    if (timeLineIndex >= lines.length) continue;
    
    const timeLine = lines[timeLineIndex];
    const match = timeLine.match(/(\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[,.]\d{3}/);
    
    if (!match) continue;
    
    const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
    
    const startTime = parseTime(startStr);
    const endTime = parseTime(endStr);
    
    // The rest of the lines are the text
    const textLines = lines.slice(timeLineIndex + 1);
    // Remove VTT specific styling tags like <c.color> or <b> for simple rendering
    const text = textLines.join('\n').replace(/<[^>]+>/g, '');
    
    cues.push({
      id: id || `${cues.length + 1}`,
      startTime,
      endTime,
      text
    });
  }
  
  return cues;
};

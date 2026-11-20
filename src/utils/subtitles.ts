export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

function seconds(timestamp: string) {
  return timestamp.replace(',', '.').split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of content.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0 || index > 1) continue;
    const timing = lines[index].match(/^((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{3})(?:\s|$)/);
    if (!timing) continue;
    const startTime = seconds(timing[1]);
    const endTime = seconds(timing[2]);
    const text = lines.slice(index + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text && endTime > startTime) cues.push({ id: String(cues.length), startTime, endTime, text });
  }
  return cues;
}

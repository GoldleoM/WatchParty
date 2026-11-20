import { youtubeId } from '../../utils/links';

export interface Clip { id: string; title: string; short: boolean }
export function clip(value: unknown): Clip | null {
  if (typeof value !== 'object' || !value) return null;
  const c = value as Partial<Clip>;
  if (typeof c.id !== 'string' || !/^[\w-]{11}$/.test(c.id) || typeof c.title !== 'string') return null;
  return { id: c.id, title: c.title.trim().slice(0, 160) || 'YouTube video', short: c.short === true };
}
export function linkClip(link: string): Clip | null {
  const id = youtubeId(link.trim());
  return id ? { id, title: 'YouTube video · ' + id, short: /\/shorts\//i.test(link) } : null;
}
export const watchUrl = (id: string) => 'https://www.youtube.com/watch?v=' + id;

export async function searchVideos(term: string, shorts: boolean, token: string, signal: AbortSignal) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('Search is unavailable. Browse on YouTube or add a video link.');
  const search = !!term || shorts;
  const args = new URLSearchParams({ part: 'snippet', maxResults: '12', key: apiKey });
  if (search) {
    args.set('type', 'video'); args.set('videoEmbeddable', 'true'); args.set('videoSyndicated', 'true');
    args.set('q', shorts ? (term + ' #shorts').trim() : term);
    if (shorts) args.set('videoDuration', 'short');
  } else { args.set('chart', 'mostPopular'); }
  if (token) args.set('pageToken', token);
  const resp = await fetch('https://www.googleapis.com/youtube/v3/' + (search ? 'search' : 'videos') + '?' + args, { signal });
  if (!resp.ok) throw new Error('YouTube search is unavailable. Try again later or add a video link.');
  const result = await resp.json() as { nextPageToken?: string; items: { id: string | { videoId: string }; snippet: { title: string } }[] };
  const decoder = new DOMParser();
  const videos = result.items.map(item => clip({
    id: typeof item.id === 'string' ? item.id : item.id.videoId,
    title: decoder.parseFromString(item.snippet.title, 'text/html').documentElement.textContent || item.snippet.title, short: shorts,
  })).filter((v): v is Clip => !!v);
  return { videos, next: result.nextPageToken || '' };
}

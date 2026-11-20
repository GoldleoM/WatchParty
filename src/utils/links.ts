import type { VideoType } from '../types';

export function roomCodeFrom(value: string): string | null {
  let code = value.trim();
  if (!/^[a-z0-9]{6}$/i.test(code)) {
    try {
      const url = new URL(code, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      code = /^\/room\/([a-z0-9]{6})\/?$/i.exec(url.pathname)?.[1] ?? '';
    } catch {
      return null;
    }
  }
  return /^[a-z0-9]{6}$/i.test(code) ? code.toUpperCase() : null;
}

export function youtubeId(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    const host = url.hostname.replace(/^(www\.|m\.)/, '');
    const parts = url.pathname.split('/');
    let id: string | null = null;
    if (host === 'youtu.be') id = parts[1];
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (['embed', 'shorts', 'live', 'v'].includes(parts[1])) id = parts[2];
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function videoLink(value: string, source: VideoType) {
  const input = value.trim();
  if (source === 'youtube') {
    const id = youtubeId(input);
    return id ? 'https://www.youtube.com/watch?v=' + id : null;
  }
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

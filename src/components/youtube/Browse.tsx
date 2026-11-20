import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchVideos, linkClip, watchUrl, type Clip } from './catalog';

export function ClipList({ videos, host, add, play }: { videos: Clip[]; host: boolean; add: (c: Clip) => void; play: (c: Clip) => void }) {
  return <ul className="clip-list">{videos.map(c => <li key={c.id}>
    <img loading="lazy" alt="" src={'https://i.ytimg.com/vi/' + c.id + '/mqdefault.jpg'} />
    <div><a href={watchUrl(c.id)} target="_blank" rel="noreferrer">{c.title}</a>
      <div className="clip-actions"><button onClick={() => add(c)}>Queue</button>{host && <button onClick={() => play(c)}>Play now</button>}</div></div>
  </li>)}</ul>;
}

interface Props { host: boolean; shorts: boolean; add: (c: Clip) => void; play: (c: Clip) => void; share: (clips: Clip[]) => void }
export function Browse({ host, shorts, add, play, share }: Props) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [videos, setVideos] = useState<Clip[]>([]);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [scrolling, setScrolling] = useState(false);
  const [sharing, setSharing] = useState(false);
  const results = useRef<HTMLDivElement>(null);
  const publisher = useRef(share);
  useEffect(() => { publisher.current = share; }, [share]);
  useEffect(() => {
    const list = results.current?.querySelector('ul');
    if (!list || !sharing || !host) return;
    let timer: ReturnType<typeof setTimeout>;
    function publishVisible() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!list) return;
        const bounds = list.getBoundingClientRect();
        const visible = videos.filter((_, i) => {
          const rect = list.children[i]?.getBoundingClientRect();
          return rect && rect.bottom > bounds.top && rect.top < bounds.bottom;
        });
        if (visible.length) publisher.current(visible.slice(0,12));
      }, 240);
    }
    publishVisible();
    list.addEventListener('scroll', publishVisible, { passive:true });
    return () => { clearTimeout(timer); list.removeEventListener('scroll', publishVisible); };
  }, [sharing, host, videos, scrolling]);
  const reelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chosen = useRef('');
  useEffect(() => () => clearTimeout(reelTimer.current), []);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function load(query: string, page = '') {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setNotice('');
    if (!page) { setScrolling(false); clearTimeout(reelTimer.current); setVideos([]); setNext(''); }
    try {
      const result = await searchVideos(query, shorts, page, controller.signal);
      if (!controller.signal.aborted) {
        setVideos(prev => Array.from(new Map([...(page ? prev : []), ...result.videos].map(v => [v.id,v])).values()));
        setTerm(query); setNext(result.next);
        if (!result.videos.length) setNotice('No videos found.');
      }
    } catch (err) { if (!controller.signal.aborted) setNotice(err instanceof Error ? err.message : 'Could not load videos.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault(); const linked = linkClip(input);
    if (linked) { add(linked); setInput(''); } else void load(input.trim());
  }
  return <section className="yt-section"><h2>Browse YouTube</h2>
    <form className="yt-search" onSubmit={submit}><input aria-label="Search YouTube or paste a link" placeholder="Search YouTube or paste a link" value={input} onChange={e => setInput(e.target.value)} />
      <button className="btn secondary" disabled={busy}>{linkClip(input) ? 'Add to queue' : busy ? 'Searching…' : input.trim() || shorts ? 'Search' : 'Popular videos'}</button></form>
    {notice && <p role="status">{notice}</p>}
    {videos.length > 0 && <>{shorts && host && <button className="btn secondary" onClick={() => {
      setScrolling(!scrolling); clearTimeout(reelTimer.current);
      if (!scrolling) { chosen.current = videos[0].id; play(videos[0]); }
    }}>{scrolling ? 'Stop scrolling Shorts' : 'Scroll Shorts together'}</button>}
      {scrolling && host ? <div className="shorts-rail" role="region" tabIndex={0} aria-label="Scroll to select the room’s next Short" onScroll={e => {
        const el = e.currentTarget; clearTimeout(reelTimer.current);
        reelTimer.current = setTimeout(() => {
          const video = videos[Math.round(el.scrollTop / el.clientHeight)];
          if (video && video.id !== chosen.current) { chosen.current = video.id; play(video); }
        }, 180);
      }}>{videos.map(c => <article key={c.id}><img src={'https://i.ytimg.com/vi/' + c.id + '/mqdefault.jpg'} alt="" /><b>{c.title}</b><button className="text-button" onClick={() => add(c)}>Queue Short</button></article>)}</div> :
      <div ref={results}><ClipList videos={videos} host={host} add={add} play={play} /></div>}
      <div className="clip-actions">{next && <button disabled={busy} onClick={() => load(term,next)}>Load more</button>}
      {host && !scrolling && <button aria-pressed={sharing} onClick={() => { if (sharing) share([]); setSharing(!sharing); }}>{sharing ? 'Stop sharing results' : 'Share browsing with room'}</button>}</div></>}
    <small><a className="text-button" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube terms</a> · <a className="text-button" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a></small>
  </section>;
}

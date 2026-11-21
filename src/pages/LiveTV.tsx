import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MdContentCopy, MdFavorite, MdFavoriteBorder, MdLiveTv, MdPlayArrow, MdSearch } from 'react-icons/md';
import catalogue from '../indian-channels.json';
import { LivePlayer } from '../components/video/LivePlayer';

type Channel = typeof catalogue[number];
const directory = 'https://iptv-org.github.io/iptv/countries/in.m3u';
const knownFeeds = new Map(catalogue.map(channel => [channel.feedId, channel]));

function refreshChannels(text: string): Channel[] {
  const streams = new Map<string, Channel>();
  for (const entry of text.split(/^#EXTINF:/m).slice(1)) {
    const [info, ...lines] = entry.trim().split(/\r?\n/);
    const feedId = /tvg-id="([^"]+)"/.exec(info)?.[1];
    if (!feedId) continue;
    const direct = lines.find(line => /^https:\/\/.*\.m3u8(?:\?|$)/i.test(line));
    const url = /http-(?:referrer|user-agent)|#KODIPROP|#EXTVLCOPT/i.test(entry) ? '' : direct?.trim() || '';
    if (streams.get(feedId)?.url) continue;
    const known = knownFeeds.get(feedId);
    const channel = known || {
      id: feedId, feedId, name: info.slice(info.lastIndexOf('",') + 2),
      logo: /tvg-logo="(https:[^"]+)"/.exec(info)?.[1] || '',
      category: /group-title="([^";]+)/.exec(info)?.[1] || 'General', languages: [],
    };
    streams.set(feedId, { ...channel, url });
  }
  const featured = catalogue.flatMap(c => streams.get(c.feedId) || []);
  return [...featured, ...Array.from(streams.values()).filter(c => !knownFeeds.has(c.feedId))];
}

function Logo({ channel }: { channel: Channel }) {
  return <span className="station-logo" aria-hidden="true"><b>{channel.name.split(' ').map(w => w[0]).slice(0, 3).join('')}</b>
    {channel.logo && <img loading="lazy" src={channel.logo} alt="" onError={e => { e.currentTarget.hidden = true; }} />}</span>;
}

export function LiveTV() {
  const [channels, setChannels] = useState(catalogue);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const ids: unknown = JSON.parse(localStorage.getItem('watchparty-tv-favorites') || '[]');
      return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
    } catch { return []; }
  });
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const requested = params.get('channel');
  const tuned = channels.find(c => c.id === requested);
  const selected = tuned ?? channels[0];
  const share = new URL('/live', window.location.origin);
  share.searchParams.set('channel', selected.id);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(directory, { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const updated = refreshChannels(await response.text());
      if (updated.length && !controller.signal.aborted) setChannels(updated);
    }).catch(() => { /* Use the tested catalogue when the directory is offline. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => { setCopy('idle'); }, [requested]);
  useEffect(() => {
    if (copy !== 'copied') return;
    const timer = window.setTimeout(() => setCopy('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  function favorite(id: string) {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem('watchparty-tv-favorites', JSON.stringify(next)); } catch { /* Keep this session’s favorites. */ }
  }
  function tune(id: string) {
    setParams({ channel: id });
    if (window.matchMedia('(max-width: 760px)').matches) document.getElementById('broadcast')?.scrollIntoView({ block: 'start' });
  }
  const languages = [...new Set(channels.flatMap(c => c.languages))].sort();
  const categories = [...new Set(channels.map(c => c.category))].sort();
  const query = search.toLowerCase().trim();
  const visible = channels.filter(c => (!language || c.languages.includes(language)) && (!category || c.category === category)
    && (!savedOnly || saved.includes(c.id)) && [c.name, c.category, ...c.languages].join(' ').toLowerCase().includes(query));
  return <div className="shell tv-page">
    <header className="tv-heading"><h1>Indian live TV</h1><p>Choose a channel and tune in to its live broadcast.</p></header>
    <div className="tv-grid">
      <section className="tv-theater panel" id="broadcast" aria-label="Selected channel">
        {tuned && !tuned.url ? <div className="channel-intro"><Logo channel={tuned} /><h2>{tuned.name}</h2>
          <p>This feed requires an external IPTV player.</p><a className="btn secondary" href={directory}>Open India playlist</a></div> : tuned ? <LivePlayer key={tuned.id} url={tuned.url} name={tuned.name} /> :
          <div className="channel-intro"><Logo channel={selected} /><h2>{selected.name}</h2>
            <button className="btn primary" onClick={() => tune(selected.id)}><MdPlayArrow /> Watch live</button></div>}
        <div className="station-heading"><div><h2>{selected.name}</h2><p>{selected.category} · {selected.languages.join(' / ')}</p></div>
          <button className="btn secondary" aria-pressed={saved.includes(selected.id)} onClick={() => favorite(selected.id)}>
            {saved.includes(selected.id) ? <MdFavorite /> : <MdFavoriteBorder />} {saved.includes(selected.id) ? 'Saved' : 'Save'}</button></div>
        {requested && !tuned && <p className="tv-note" role="status">This channel is no longer in the guide. Choose another to watch.</p>}
        <div className="station-share"><button className="text-button" onClick={async () => {
          try { await navigator.clipboard.writeText(share.href); setCopy('copied'); } catch { setCopy('manual'); }
        }}><MdContentCopy /> {copy === 'copied' ? 'Channel link copied' : 'Share channel'}</button>
        {copy === 'manual' && <input aria-label="Channel link" readOnly value={share.href} onFocus={e => e.target.select()} />}</div>
      </section>
      <section className="panel channel-guide" style={{ minWidth: 0, overflowWrap: 'anywhere' }}><h2><MdLiveTv /> Channel guide</h2>
        <div className="channel-filters">
          <label className="channel-search"><MdSearch /><input aria-label="Search channels" type="search" value={search} placeholder="Search channels" onChange={e => setSearch(e.target.value)} /></label>
          <select aria-label="Filter by language" value={language} onChange={e => setLanguage(e.target.value)}><option value="">All languages</option>{languages.map(l => <option key={l}>{l}</option>)}</select>
          <select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="guide-summary"><span role="status">{visible.length} {visible.length === 1 ? 'channel' : 'channels'}</span>
          <button className="text-button" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><MdFavoriteBorder /> Saved only</button></div>
        <ul className="station-list">{visible.map(c => <li key={c.id}><button aria-pressed={tuned?.id === c.id} onClick={() => tune(c.id)}>
          <Logo channel={c} /><span><b>{c.name}</b><small>{c.category} · {c.languages.join(' / ')}</small></span><MdPlayArrow /></button></li>)}</ul>
        {!visible.length && <div className="no-stations"><p>{savedOnly && !saved.length ? 'Save a channel while watching to find it here.' : 'No channels match these filters.'}</p>
          <button className="text-button" onClick={() => { setSearch(''); setLanguage(''); setCategory(''); setSavedOnly(false); }}>Show all channels</button></div>}
      </section>
    </div>
    <p className="film-credit">Channel directory from <a href="https://github.com/iptv-org/iptv">IPTV-org</a>. Availability varies by broadcaster and region.</p>
  </div>;
}

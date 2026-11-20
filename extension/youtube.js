// A tab is paired only when a member opens it from their WatchParty room.
(async () => {
  const post = msg => chrome.runtime.sendMessage(msg).catch(() => ({ ok: false }));
  const pair = await post({ kind: 'paired' });
  if (!pair?.ok) return;
  const dock = document.createElement('div');
  const shadow = dock.attachShadow({ mode: 'closed' });
  shadow.innerHTML = '<style>:host{position:fixed;z-index:2147483647;bottom:18px;right:18px}section{background:#201c20;color:white;padding:10px 14px;border:1px solid #675451;border-radius:12px;font:14px system-ui;max-width:290px;box-shadow:0 4px 24px #0008}strong,small{display:block;margin:3px 0}button{border:0;border-radius:6px;background:#ffbd67;color:#26190e;padding:7px 12px;cursor:pointer;font-weight:bold;margin-top:5px}button:disabled{opacity:.55}</style><section><strong>WatchParty</strong><small></small><button disabled>Add to room queue</button></section>';
  document.documentElement.append(dock);
  const detail = shadow.querySelector('small');
  const add = shadow.querySelector('button');
  const item = (href, title) => {
    let url;
    try { url = new URL(href, location.origin); } catch { return null; }
    if (url.origin !== location.origin) return null;
    const short = url.pathname.startsWith('/shorts/');
    const id = short ? url.pathname.split('/')[2] : url.pathname === '/watch' && url.searchParams.get('v');
    return typeof id === 'string' && /^[\w-]{11}$/.test(id)
      ? { id, title: (title?.trim() || 'YouTube video').slice(0,160), short } : null;
  };
  const current = () => item(location.href, document.title.replace(/\s*- YouTube$/, ''));
  function fromLink(link) {
    if (!link) return null;
    return item(link.href, link.title || link.getAttribute('aria-label') || link.textContent);
  }
  let selected = null;
  let messageUntil = 0;
  function render() {
    if (Date.now() < messageUntil) return;
    const video = selected || current();
    detail.textContent = video?.title || 'Hover over or focus a video link to queue it.';
    add.disabled = !video;
  }
  function select(e) {
    if (e.target === dock) return;
    const video = fromLink(e.target.closest?.('a[href]'));
    if (video) selected = video;
    render();
  }
  document.addEventListener('pointerover', select);
  document.addEventListener('focusin', select);
  add.onclick = async () => {
    const video = selected || current();
    if (!video) return;
    const r = await post({ kind: 'queue', video });
    detail.textContent = r?.ok ? 'Added to the room queue.' : 'Reconnect this tab from your WatchParty room.';
    messageUntil = Date.now() + 2200;
  };
  let shelfSignature = '', lastMedia = '', lastSent = 0, busy = false;
  async function sync() {
    render();
    if (!pair.share || busy) return;
    busy = true;
    try {
      const video = current();
      const shortsRoot = document.querySelector('ytd-reel-video-renderer[is-active],ytd-reel-video-renderer[active]');
      const player = (video?.short && shortsRoot ? shortsRoot : document).querySelector('video.html5-main-video,video');
      if (video && player && player.readyState >= 1 && !document.querySelector('.html5-video-player.ad-showing')) {
        const signature = video.id + '/' + player.paused + '/' + player.playbackRate;
        if (signature !== lastMedia || Date.now() - lastSent > 3500) {
          const r = await post({ kind: 'media', video, playing: !player.paused && !player.ended,
            time: player.currentTime, rate: player.playbackRate });
          if (r?.ok) { lastMedia = signature; lastSent = Date.now(); }
        }
      } else if (lastMedia && !video) {
        await post({ kind: 'away' }); lastMedia = '';
      }
      if (document.hidden) return;
      const found = new Map();
      for (const link of document.querySelectorAll('a[href*="/watch?"],a[href*="/shorts/"]')) {
        const rect = link.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
        const v = fromLink(link);
        if (v && (!found.has(v.id) || found.get(v.id).title === 'YouTube video')) found.set(v.id, v);
        if (found.size >= 12) break;
      }
      const videos = Array.from(found.values());
      const signature = JSON.stringify(videos);
      if (videos.length && signature !== shelfSignature) {
        if ((await post({ kind: 'shelf', videos }))?.ok) shelfSignature = signature;
      }
    } finally { busy = false; }
  }
  document.addEventListener('yt-navigate-finish', () => { selected = null; render(); });
  render();
  const timer = setInterval(sync, 1100);
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.kind === 'queue-link') {
      const link = Array.from(document.links).find(a => a.href === msg.url);
      selected = fromLink(link) || item(msg.url, '');
      if (selected) { messageUntil = 0; render(); add.click(); }
      return;
    }
    if (msg.kind !== 'stop') return;
    clearInterval(timer);
    document.removeEventListener('pointerover', select);
    document.removeEventListener('focusin', select);
    if (pair.share) document.querySelectorAll('video').forEach(video => video.pause());
    dock.remove();
  });
})();

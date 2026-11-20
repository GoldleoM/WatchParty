const parties = new Set(['https://watchparty-d9b26.web.app','https://watchparty-d9b26.firebaseapp.com']);
const youtube = 'https://www.youtube.com';
const key = id => 'youtube-' + id;
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'watchparty-queue', title: 'Add to WatchParty queue', contexts: ['link'],
    documentUrlPatterns: ['https://www.youtube.com/*'], targetUrlPatterns: ['https://www.youtube.com/watch*','https://www.youtube.com/shorts/*'] });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'watchparty-queue' && tab?.id && (await chrome.storage.session.get(key(tab.id)))[key(tab.id)]) {
    await chrome.tabs.sendMessage(tab.id, {kind:'queue-link', url:info.linkUrl}).catch(() => {});
  }
});

async function route(message, sender) {
  if (!sender.tab || sender.frameId !== 0) return;
  const source = new URL(sender.url);
  if (parties.has(source.origin) && message.kind === 'stop') {
    const pairs = await chrome.storage.session.get(null);
    for (const [id, pair] of Object.entries(pairs)) {
      if (pair.roomTab === sender.tab.id && pair.session === message.session) {
        await chrome.storage.session.remove(id);
        await chrome.tabs.sendMessage(Number(id.slice(8)), {kind:'stop'}).catch(() => {});
      }
    }
    return { ok: true };
  }
  if (parties.has(source.origin) && /^\/room\/[a-z0-9]{6}\/?$/i.test(source.pathname) && message.kind === 'open') {
    if (typeof message.session !== 'string' || message.session.length > 64) return;
    const tab = await chrome.tabs.create({ url: 'about:blank' });
    await chrome.storage.session.set({ [key(tab.id)]: {
      roomTab: sender.tab.id, roomOrigin: source.origin, roomPath: source.pathname, session: message.session, share: message.share === true,
    } });
    await chrome.tabs.update(tab.id, { url: youtube + (message.shorts ? '/shorts/' : '/') });
    return { ok: true };
  }
  if (source.origin !== youtube) return;
  const pair = (await chrome.storage.session.get(key(sender.tab.id)))[key(sender.tab.id)];
  if (!pair) return;
  const roomTab = await chrome.tabs.get(pair.roomTab);
  if (!roomTab.url || new URL(roomTab.url).origin !== pair.roomOrigin || new URL(roomTab.url).pathname !== pair.roomPath) return;
  if (message.kind === 'paired') return { ok: true, share: pair.share };
  if (message.kind !== 'queue' && !(pair.share && ['shelf','media','away'].includes(message.kind))) return;
  return chrome.tabs.sendMessage(pair.roomTab, { ...message, session: pair.session });
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  route(message, sender).then(result => reply(result || { ok: false }), () => reply({ ok: false }));
  return true;
});
chrome.tabs.onRemoved.addListener(async id => {
  const pairs = await chrome.storage.session.get(null);
  const pair = pairs[key(id)];
  if (pair) await chrome.tabs.sendMessage(pair.roomTab, { kind: 'away', session: pair.session }).catch(() => {});
  await chrome.storage.session.remove(Object.keys(pairs).filter(k => k === key(id) || pairs[k]?.roomTab === id));
});

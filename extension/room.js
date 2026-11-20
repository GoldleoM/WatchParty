const origin = location.origin;
const pending = new Map();
const send = data => window.postMessage({ source: 'watchparty-companion', ...data }, origin);
window.addEventListener('message', event => {
  const msg = event.data;
  if (event.source !== window || event.origin !== origin || msg?.source !== 'watchparty-room') return;
  if (msg.kind === 'ping') send({ kind: 'installed' });
  if (msg.kind === 'stop') chrome.runtime.sendMessage({kind:'stop', session:msg.session}).catch(() => {});
  if (msg.kind === 'open') chrome.runtime.sendMessage({ kind: 'open', session: msg.session, shorts: msg.shorts, share: msg.share })
    .then(r => { if (!r?.ok) send({ kind: 'open-error', session: msg.session }); })
    .catch(() => send({ kind: 'open-error', session: msg.session }));
  if (msg.kind === 'reply') pending.get(msg.request)?.(msg.ok);
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const request = crypto.randomUUID();
  const timer = setTimeout(() => finish(false), 10000);
  function finish(ok) { clearTimeout(timer); pending.delete(request); reply({ ok }); }
  pending.set(request, finish);
  send({ ...msg, request });
  return true;
});

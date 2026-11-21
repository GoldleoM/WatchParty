// Uses a dedicated Firebase Auth account. Its room_cleanup claim is checked by Firestore rules.
const { project, apiKey, email, password } = JSON.parse(process.env.WATCHPARTY_CLEANUP);
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const origin = emulator ? 'http://' + emulator : 'https://firestore.googleapis.com';
const identity = process.env.FIREBASE_AUTH_EMULATOR_HOST
  ? 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/identitytoolkit.googleapis.com'
  : 'https://identitytoolkit.googleapis.com';
const database = 'projects/' + project + '/databases/(default)';
const base = origin + '/v1/' + database + '/documents';
const login = await fetch(identity + '/v1/accounts:signInWithPassword?key=' + encodeURIComponent(apiKey), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});
if (!login.ok) throw new Error('Cleanup sign-in failed (' + login.status + ')');
const { idToken } = await login.json();

async function request(path, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error('Firestore returned ' + data.error?.status), { status: res.status });
  return data;
}

function recentMember(fields, now) {
  const seen = Date.parse(fields.lastSeen?.timestampValue) || Number(fields.lastActive?.integerValue || fields.lastActive?.doubleValue || 0);
  const connections = fields.connections?.mapValue;
  const connected = fields.status?.stringValue !== 'offline' && (!connections || Object.keys(connections.fields || {}).length > 0);
  const seconds = connected ? 90 : 12;
  return now - seen < seconds * 1000;
}

async function closeIfEmpty(path) {
  const { transaction } = await request(':beginTransaction', { options: { readWrite: {} } });
  let committed = false;
  try {
    const [result] = await request(':batchGet', { transaction, documents: [database + '/documents' + path] });
    const room = result.found;
    if (!room) return;
    if (room.fields.closed?.booleanValue) return room;
    const results = await request(path + ':runQuery', {
      transaction, structuredQuery: { from: [{ collectionId: 'members' }] },
    });
    const members = results.filter(row => row.document);
    const now = Date.parse(results.at(-1)?.readTime) || Date.now();
    if (members.some(row => recentMember(row.document.fields, now))) return;
    if (!members.length && now - Number(room.fields.createdAt?.integerValue || room.fields.createdAt?.doubleValue || now) < 90000) return;
    const commit = await request(':commit', { transaction, writes: [{
      update: { name: room.name, fields: { closed: { booleanValue: true } } },
      currentDocument: { updateTime: room.updateTime },
    }] });
    committed = true;
    return { name: room.name, updateTime: commit.writeResults[0].updateTime };
  } finally {
    if (!committed) await request(':rollback', { transaction }).catch(() => {});
  }
}

async function purge(path, room) {
  for (const group of ['messages', 'reactions', 'members']) {
    for (;;) {
      const { documents = [] } = await request(path + '/' + group + '?pageSize=200&mask.fieldPaths=__name__');
      if (!documents.length) break;
      await request(':commit', { writes: documents.map(d => ({ delete: d.name, currentDocument: { updateTime: d.updateTime } })) });
    }
  }
  await request(':commit', { writes: [{ delete: room.name, currentDocument: { updateTime: room.updateTime } }] });
}

let removed = 0;
let conflicts = 0;
let cursor = '';
const onlyRooms = new Set(process.argv.slice(2));
do {
  const page = await request('/rooms?pageSize=200&mask.fieldPaths=closed&pageToken=' + encodeURIComponent(cursor));
  for (const doc of page.documents || []) {
    const id = doc.name.split('/').pop();
    if (onlyRooms.size && !onlyRooms.has(id)) continue;
    const path = '/rooms/' + encodeURIComponent(id);
    try {
      const room = doc.fields?.closed?.booleanValue ? doc : await closeIfEmpty(path);
      if (room) { await purge(path, room); removed++; }
    } catch (e) {
      if (![404, 409].includes(e.status)) throw e;
      conflicts++;
    }
  }
  cursor = page.nextPageToken || '';
} while (cursor);
console.log('Removed %d closed or empty rooms. Deferred %d concurrent changes.', removed, conflicts);

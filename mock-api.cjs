const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const host = '127.0.0.1';
const port = 4317;
const requests = [];
const tags = [{ id: 7, tagName: 'healthy' }, { id: 9, tagName: 'native' }];
let approved = false;
let writes = [];
let reloadsAfterTagRequests = 0;
const capture = {
  id: 42, uuid: 'fixture-capture-42', active: true, approved: false,
  imageUrl: `http://${host}:${port}/fixture/capture.svg`,
  lat: -1.2, lon: 36.8, planterId: 12, planterIdentifier: 'fixture-grower',
  timeCreated: '2026-10-28T12:00:00.000Z', speciesId: null,
};

function json(res, data, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', connection: 'close' });
  res.end(JSON.stringify(data));
}
function state() {
  return {
    approved, writes: writes.map(({ id, body, done }) => ({ id, body, done })),
    persistedTags: writes.filter((w) => w.done).length,
    pendingTags: writes.filter((w) => !w.done).length,
    reloadsAfterTagRequests,
  };
}
const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, `http://${host}:${port}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  const body = raw ? JSON.parse(raw) : null;
  requests.push({ at: new Date().toISOString(), method: req.method, path: url.pathname, body });
  if (url.pathname === '/fixture/status') return json(res, state());
  if (url.pathname === '/fixture/requests') return json(res, requests);
  if (url.pathname === '/fixture/reset') {
    writes.forEach((w) => { if (!w.done) json(w.res, { error: 'Fixture reset' }, 409); });
    approved = false; writes = []; reloadsAfterTagRequests = 0; requests.length = 0;
    return json(res, state());
  }
  if (url.pathname.startsWith('/fixture/release/')) {
    const write = writes.find((w) => w.id === Number(url.pathname.split('/').pop()));
    if (!write || write.done) return json(res, { error: 'No pending write' }, 404);
    write.done = true;
    json(write.res, { id: 100 + write.id, ...write.body });
    return json(res, state());
  }
  if (url.pathname.startsWith('/img/') || url.pathname === '/fixture/capture.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="#e5efe4"/><path d="M240 90L110 320h80l-95 150h290l-95-150h80z" fill="#3e7347"/><path d="M226 465h28v100h-28z" fill="#796143"/><text x="240" y="610" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#24452b">Local test capture 42</text></svg>');
  }
  if (url.pathname === '/api/tree_tags' && req.method === 'POST') {
    writes.push({ id: writes.length + 1, body, done: false, res });
    return;
  }
  if (url.pathname === '/api/tags' && req.method === 'POST') {
    return json(res, tags.find((t) => t.tagName === body.tagName) || { id: 11, ...body });
  }
  if (url.pathname.endsWith('/trees/42') && req.method === 'PATCH') {
    approved = true;
    return json(res, { ...capture, ...body });
  }
  if (url.pathname.endsWith('/trees/count')) return json(res, { count: approved ? 0 : 1 });
  if (url.pathname.endsWith('/trees')) {
    if (writes.length) reloadsAfterTagRequests++;
    return json(res, approved ? [] : [capture]);
  }
  if (url.pathname === '/api/tags') return json(res, tags);
  if (url.pathname === '/api/species') return json(res, []);
  if (url.pathname.endsWith('/organizations')) return json(res, []);
  if (url.pathname === '/auth/check_session') return json(res, {});
  if (url.pathname.startsWith('/api/tags/')) return json(res, tags.find((t) => t.id === Number(url.pathname.split('/').pop())) || {});
  return json(res, []);
});
server.listen(port, host, () => console.log(`Mock API listening on http://${host}:${port}`));
process.on('SIGINT', () => {
  fs.writeFileSync(path.join(__dirname, 'requests.json'), JSON.stringify(requests, null, 2));
  server.close();
});

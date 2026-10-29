const http = require('node:http');

const host = '127.0.0.1';
const port = 4318;
const species = { id: 3, name: 'Mango', desc: 'Local fixture species' };
const tag = { id: 7, tagName: 'healthy' };
const capture = {
  id: 42, uuid: 'fixture-capture-42', active: true, approved: false,
  imageUrl: `http://${host}:${port}/fixture/capture.svg`,
  lat: -1.2, lon: 36.8, planterId: 12, planterIdentifier: 'fixture-grower',
  timeCreated: '2026-10-28T12:00:00.000Z', speciesId: 3,
  treeTags: [{ tagId: 7 }], note: 'Local fixture for concurrent capture details',
};
let held = {};
let requested = [];
let completed = [];

function json(res, value, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json', 'access-control-allow-origin': '*',
    connection: 'close',
  });
  res.end(JSON.stringify(value));
}

function state() {
  return { captureId: 42, requested, completed,
    pending: Object.keys(held).filter((name) => !completed.includes(name)) };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === '/fixture/status') return json(res, state());
  if (url.pathname === '/fixture/reset') {
    for (const [name, response] of Object.entries(held)) {
      if (!completed.includes(name)) json(response, { error: 'Fixture reset' }, 409);
    }
    held = {}; requested = []; completed = [];
    return json(res, state());
  }
  if (url.pathname.startsWith('/fixture/release/')) {
    const name = url.pathname.split('/').pop();
    if (!held[name] || completed.includes(name)) return json(res, { error: 'No pending response' }, 404);
    completed.push(name);
    json(held[name], name === 'species' ? species : tag);
    return json(res, state());
  }
  if (url.pathname === '/api/species/3' || url.pathname === '/api/tags/7') {
    const name = url.pathname.includes('species') ? 'species' : 'tag';
    requested.push(name);
    held[name] = res;
    return;
  }
  if (url.pathname === '/fixture/capture.svg' || url.pathname.startsWith('/img/')) {
    res.writeHead(200, { 'content-type': 'image/svg+xml', connection: 'close' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="#e5efe4"/><path d="M240 90L110 320h80l-95 150h290l-95-150h80z" fill="#3e7347"/><path d="M226 465h28v100h-28z" fill="#796143"/><text x="240" y="610" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#24452b">Local test capture 42</text></svg>');
  }
  if (url.pathname.endsWith('/trees/42')) return json(res, capture);
  if (url.pathname.endsWith('/trees/count')) return json(res, { count: 1 });
  if (url.pathname.endsWith('/trees')) return json(res, [capture]);
  if (url.pathname === '/api/species') return json(res, [species]);
  if (url.pathname === '/api/tags') return json(res, [tag]);
  if (url.pathname.endsWith('/organizations')) return json(res, []);
  if (url.pathname === '/auth/check_session') return json(res, {});
  if (url.pathname === '/countries') return json(res, { countries: [{ name: 'Local test country' }] });
  return json(res, []);
});

server.listen(port, host, () => console.log(`Mock detail API listening on http://${host}:${port}`));
process.on('SIGINT', () => {
  for (const [name, response] of Object.entries(held)) {
    if (!completed.includes(name)) json(response, { error: 'Fixture shutdown' }, 503);
  }
  server.close();
});

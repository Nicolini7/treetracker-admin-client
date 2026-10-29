const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const repository = process.env.ADMIN_CLIENT_PATH || path.resolve(__dirname, '../treetracker-admin-client');
const { Before, Given, When, Then, AfterAll, setDefaultTimeout } = require(path.join(repository, 'node_modules/@cucumber/cucumber'));
const api = 'http://127.0.0.1:4318';
const output = path.join(__dirname, 'output/playwright/passing-run');
const observations = [];
let recording = false;
let opened = false;
let commandId = 0;
let scriptId = 0;
setDefaultTimeout(120000);
fs.mkdirSync(output, { recursive: true });

function findCli() {
  if (process.env.PLAYWRIGHT_CLI_PATH) return process.env.PLAYWRIGHT_CLI_PATH;
  const cache = process.env.npm_config_cache || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA, 'npm-cache')
    : path.join(os.homedir(), '.npm'));
  for (const entry of fs.readdirSync(path.join(cache, '_npx'))) {
    const candidate = path.join(cache, '_npx', entry, 'node_modules/@playwright/cli/playwright-cli.js');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Run npx --yes @playwright/cli --version once before this scenario');
}
const cliPath = findCli();

function cli(...args) {
  const result = spawnSync(process.execPath, [cliPath, '-s=capture-detail-bdd', ...args], {
    cwd: __dirname, encoding: 'utf8', timeout: 90000, maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  const text = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(output, `command-${++commandId}.log`), text);
  if (result.error) throw result.error;
  if (result.status !== 0 || /### Error/.test(text)) throw new Error(text);
  return text;
}
function run(code) {
  const file = path.join(output, `step-${++scriptId}.cjs`);
  fs.writeFileSync(file, `async (page) => {\n${code}\n}`);
  return cli('run-code', '--filename', file);
}
async function control(endpoint) {
  const response = await fetch(`${api}/fixture/${endpoint}`, {
    headers: { connection: 'close' },
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function status(order, stage) {
  const result = await control('status');
  observations.push({ order, stage, at: new Date().toISOString(), ...result });
  return result;
}
function chip(name) {
  return `page.locator('.MuiDrawer-paper .MuiChip-label').filter({ hasText: /^${name}$/ })`;
}

Before(function ({ pickle }) {
  this.order = pickle.name.includes('species response') ? 'species' : 'tag';
  this.remaining = this.order === 'species' ? 'tag' : 'species';
});

Given('a local verifier opens capture 42 details', async function () {
  await control('reset');
  if (!opened) {
    cli('open', 'about:blank', '--browser', 'chrome', '--headed');
    cli('run-code', '--filename', path.join(__dirname, 'configure-browser.cjs'));
    opened = true;
  } else {
    run(`await page.goto('http://127.0.0.1:3001/verify');`);
  }
  run(`await page.getByRole('heading', { name: '1 capture', exact: true }).waitFor();`);
  cli('snapshot');
  run(`await page.getByRole('button', { name: 'Capture details', exact: true }).click();
    await page.getByText('Capture Data', { exact: true }).waitFor();
    await page.getByText('Species', { exact: true }).scrollIntoViewIfNeeded();`);
  cli('snapshot');
  if (!recording) {
    cli('video-start', path.join(output, 'capture-detail.webm'), '--size', '1440x1000', '--fps', '15');
    recording = true;
  }
});

Given('species and tag requests are both pending', async function () {
  const result = await status(this.order, 'both-pending');
  assert.deepEqual([...result.requested].sort(), ['species', 'tag']);
  assert.deepEqual([...result.pending].sort(), ['species', 'tag']);
  assert.deepEqual(result.completed, []);
  run(`if (await ${chip('Mango')}.count()) throw new Error('Species response is still held');
    if (await ${chip('healthy')}.count()) throw new Error('Tag response is still held');`);
  cli('screenshot', '--filename', path.join(output, `${this.order}-first-pending.png`));
});

When('the {string} response finishes first', async function (first) {
  assert.equal(first, this.order);
  await control(`release/${first}`);
});

Then('its detail is visible while the other response is pending', async function () {
  const name = this.order === 'species' ? 'Mango' : 'healthy';
  const missing = this.order === 'species' ? 'healthy' : 'Mango';
  run(`await ${chip(name)}.waitFor({ state: 'visible' });
    await ${chip(name)}.scrollIntoViewIfNeeded();
    if (await ${chip(missing)}.count()) throw new Error('Other response is still held');`);
  const result = await status(this.order, 'one-response');
  assert.deepEqual(result.completed, [this.order]);
  assert.deepEqual(result.pending, [this.remaining]);
  cli('screenshot', '--filename', path.join(output, `${this.order}-first-one-response.png`));
});

When('the remaining response finishes', async function () {
  await control(`release/${this.remaining}`);
});

Then('Mango and healthy are both visible in capture details', async function () {
  run(`await ${chip('Mango')}.waitFor({ state: 'visible' });
    await ${chip('healthy')}.waitFor({ state: 'visible' });
    await ${chip('healthy')}.scrollIntoViewIfNeeded();
    if (await ${chip('Mango')}.count() !== 1 || await ${chip('healthy')}.count() !== 1) {
      throw new Error('Both detail fields must remain rendered exactly once');
    }`);
  const result = await status(this.order, 'both-responses');
  assert.equal(result.captureId, 42);
  assert.deepEqual(result.completed, [this.order, this.remaining]);
  assert.deepEqual(result.pending, []);
  assert.equal(result.requested.length, 2);
  cli('screenshot', '--filename', path.join(output, `${this.order}-first-completed.png`));
});

AfterAll(() => {
  fs.writeFileSync(path.join(output, 'browser-observations.json'), JSON.stringify(observations, null, 2));
  if (recording) cli('video-stop');
  if (opened) cli('close');
});

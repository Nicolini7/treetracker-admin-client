const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const repository = process.env.ADMIN_CLIENT_PATH || path.resolve(__dirname, '../treetracker-admin-client');
const { Given, When, Then, AfterAll, setDefaultTimeout } = require(path.join(repository, 'node_modules/@cucumber/cucumber'));
const api = 'http://127.0.0.1:4317';
const output = path.join(__dirname, 'output/playwright/passing-run');
const observations = [];
let recording = false;
let codeId = 0;
let commandId = 0;
setDefaultTimeout(120000);
fs.mkdirSync(output, { recursive: true });

function cli(...args) {
  const quoted = args.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(' ');
  const commandOutput = path.join(output, `command-${++commandId}.log`);
  const processResult = spawnSync('powershell.exe', ['-NoProfile', '-Command', `& npx.cmd --yes @playwright/cli -s=capture-tags-bdd ${quoted} > '${commandOutput.replace(/'/g, "''")}' 2>&1; exit $LASTEXITCODE`], {
    cwd: __dirname, encoding: 'utf8', timeout: 90000, stdio: 'ignore',
  });
  const bytes = fs.readFileSync(commandOutput);
  const result = bytes[0] === 0xff && bytes[1] === 0xfe
    ? bytes.toString('utf16le').replace(/^\uFEFF/, '')
    : bytes.toString('utf8');
  if (processResult.error) throw processResult.error;
  if (processResult.status !== 0) throw new Error(result);
  if (/### Error/.test(result)) throw new Error(result);
  fs.appendFileSync(path.join(output, 'browser-commands.log'), result + '\n');
  return result;
}
function run(code) {
  const filename = path.join(output, `step-${++codeId}.cjs`);
  fs.writeFileSync(filename, `async (page) => {\n${code}\n}`);
  return cli('run-code', '--filename', filename);
}
async function status(stage) {
  const result = await fetch(`${api}/fixture/status`, { headers: { connection: 'close' } }).then((res) => res.json());
  observations.push({ stage, at: new Date().toISOString(), ...result });
  return result;
}
function assertProgress() {
  run(`await page.locator('[role="progressbar"]').waitFor({ state: 'visible' });
    if (!(await page.locator('body > [role="presentation"]').isVisible())) throw new Error('Processing modal must remain visible');`);
}

Given('a local verifier is viewing one pending capture', async () => {
  await fetch(`${api}/fixture/reset`, { headers: { connection: 'close' } }).then((res) => res.json());
  cli('open', 'about:blank', '--browser', 'chrome', '--headed');
  cli('run-code', '--filename', path.join(__dirname, 'configure-browser.cjs'));
  run(`await page.getByRole('heading', { name: '1 capture', exact: true }).waitFor();`);
  cli('snapshot');
  cli('video-start', path.join(output, 'capture-tag-writes.webm'), '--size', '1440x1000', '--fps', '15');
  recording = true;
});

Given('the capture is selected with the additional tags healthy and native', () => {
  run(`await page.getByRole('button', { name: 'Select All', exact: true }).click();
    const input = page.getByTestId('tag-chip-input').getByRole('textbox');
    await input.fill('healthy'); await input.press('Enter');
    await input.fill('native'); await input.press('Enter');
    await page.getByRole('button', { name: 'healthy', exact: true }).waitFor();
    await page.getByRole('button', { name: 'native', exact: true }).waitFor();`);
  cli('snapshot');
  cli('screenshot', '--filename', path.join(output, 'ready.png'));
});

When('the verifier submits approval', () => {
  run(`await page.getByRole('button', { name: 'SUBMIT', exact: true }).click();`);
});

Then('approval remains in progress while both tag writes are pending', async () => {
  assertProgress();
  const result = await status('two-pending');
  assert.equal(result.pendingTags, 2);
  assert.equal(result.persistedTags, 0);
  assert.equal(result.reloadsAfterTagRequests, 0);
  assert.deepEqual(result.writes.map((write) => write.body), [{ treeId: 42, tagId: 7 }, { treeId: 42, tagId: 9 }]);
  cli('screenshot', '--filename', path.join(output, 'two-pending.png'));
});

When('the first tag write finishes', async () => {
  await fetch(`${api}/fixture/release/1`, { headers: { connection: 'close' } }).then((res) => res.json());
});

Then('approval remains in progress while the second tag write is pending', async () => {
  assertProgress();
  const result = await status('one-pending');
  assert.equal(result.pendingTags, 1);
  assert.equal(result.persistedTags, 1);
  assert.equal(result.reloadsAfterTagRequests, 0);
  cli('screenshot', '--filename', path.join(output, 'one-pending.png'));
});

When('the second tag write finishes', async () => {
  await fetch(`${api}/fixture/release/2`, { headers: { connection: 'close' } }).then((res) => res.json());
});

Then('approval finishes and the capture list refreshes', async () => {
  run(`await page.locator('[role="progressbar"]').waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name: '0 captures', exact: true }).waitFor();
    if (await page.locator('#card_42').count()) throw new Error('Approved capture must leave pending list');
    if (await page.locator('body > [role="presentation"]').count()) throw new Error('Processing modal must close');`);
  const result = await status('completed');
  assert.equal(result.pendingTags, 0);
  assert.equal(result.persistedTags, 2);
  assert.equal(result.reloadsAfterTagRequests, 1);
  cli('screenshot', '--filename', path.join(output, 'completed.png'));
});

AfterAll(() => {
  fs.writeFileSync(path.join(output, 'browser-observations.json'), JSON.stringify(observations, null, 2));
  if (recording) cli('video-stop');
  cli('close');
});

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const repository = process.env.ADMIN_CLIENT_PATH || path.resolve(__dirname, '../treetracker-admin-client');
const env = { ...process.env, BROWSER: 'none', HOST: '127.0.0.1', PORT: '3001' };
const configuration = fs.readFileSync(path.join(repository, '.env.development'), 'utf8');
for (const [, name] of configuration.matchAll(/^(REACT_APP_\w+_ROOT)=/gm)) {
  env[name] = 'http://127.0.0.1:4317';
}
env.REACT_APP_WEBMAP_DOMAIN = 'http://127.0.0.1:4317';
for (const name of ['URL', 'REALM', 'CLIENT_ID']) env[`REACT_APP_KEYCLOAK_${name}`] = '';
const child = spawn(process.execPath, [path.join(repository, 'node_modules/react-scripts/scripts/start.js')], {
  cwd: repository, env, stdio: 'inherit',
});
child.on('exit', (code) => { process.exitCode = code || 0; });

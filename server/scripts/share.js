// `npm run share` — one command to show the website to anyone, anywhere:
//   1. opens a free Cloudflare quick tunnel (no account, no firewall/admin rights needed)
//   2. starts the website with PUBLIC_URL = the tunnel link, so the Share button + QR use it
// Keep this ONE terminal open. Ctrl + C stops both the website and the tunnel.
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8080;
process.env.PORT = String(PORT);

console.log('\nStarting a Cloudflare tunnel… (first time downloads cloudflared, ~30 s)\n');

const tunnel = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], {
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let started = false;
let connected = false;
const onOutput = (buf) => {
  const text = buf.toString();
  if (process.env.SHARE_DEBUG) process.stdout.write(text);
  // the tunnel link is printed inside a box; ignore Cloudflare's own api.trycloudflare.com
  const m = [...text.matchAll(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/gi)].find((x) => x[1].toLowerCase() !== 'api');
  if (m && !started) {
    started = true;
    process.env.PUBLIC_URL = m[0];
    import('../index.js').then(() => {
      setTimeout(() => banner(m[0]), 300);
    });
  }
  if (/Registered tunnel connection/i.test(text) && !connected) {
    connected = true;
    if (started) console.log('✓ Tunnel connected — the link is live (allow ~30 s the very first time).\n');
  }
  if (/failed|error/i.test(text) && /ERR/.test(text) && !process.env.SHARE_DEBUG) {
    const line = text.split('\n').find((l) => / ERR /.test(l));
    if (line) console.log('[tunnel] ' + line.replace(/^\S+\s+ERR\s+/, ''));
  }
};
tunnel.stdout.on('data', onOutput);
tunnel.stderr.on('data', onOutput);

tunnel.on('exit', (code) => {
  if (!started) {
    console.log('\n[tunnel] Could not create a Cloudflare link (internet / office network may block it).');
    console.log('         Try again on a phone hotspot, or run "SHARE_DEBUG=1 npm run share" to see details.\n');
    process.exit(1);
  }
  console.log(`\n[tunnel] stopped (code ${code}). The public link no longer works — run "npm run share" again.`);
});

function banner(url) {
  const rows = ['SHARE THIS LINK (works on any network, any device)', '', `  ${url}`, '', `Admin: ${url}/#/admin`];
  const w = Math.max(...rows.map((r) => r.length)) + 4;
  console.log('\n┌' + '─'.repeat(w) + '┐');
  for (const r of rows) console.log('│  ' + r.padEnd(w - 2) + '│');
  console.log('└' + '─'.repeat(w) + '┘');
  console.log('Keep this terminal open. Ctrl + C stops the website and the link.\n');
}

const stop = () => {
  try {
    tunnel.kill();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

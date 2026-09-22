import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { reportRequest } from './report-server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.psk': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  if (new URL(req.url, 'http://localhost').pathname.startsWith('/api/community/')) { res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Community features require the deployed Cloudflare site or the Cloudflare local development server.' })); return; }
  if (new URL(req.url, 'http://localhost').pathname === '/api/report') { reportRequest(req, res); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const base = path.join(root, pathname.startsWith('/SkinViewer/assets/') ? 'r2' : 'public');
  const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(base, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => /^[._]/.test(part))) {
    res.writeHead(403).end(); return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT) || 8001, '127.0.0.1', () => {
  const url = `http://localhost:${server.address().port}`;
  console.log(`SkinForge Cloudflare preview: ${url}`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${url}'`],
      { windowsHide: true }, error => { if (error) console.error(`Open ${url} in your browser.`); });
  }
});

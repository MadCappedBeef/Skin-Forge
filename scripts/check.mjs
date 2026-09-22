import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/SkinViewer/catalog.json')));
let bytes = 0;
for (const [key, hash] of Object.entries(manifest)) {
  const data = fs.readFileSync(path.join(root, 'r2', key));
  if (createHash('sha256').update(data).digest('hex') !== hash) throw Error(`Asset changed: ${key}`);
  bytes += data.length;
}
for (const species of catalog.species) {
  for (const file of [species.model, species.normal, species.mask, species.hatchling, species.juvenile, ...species.patterns].filter(Boolean)) {
    const url = new URL(file, 'https://skinforge.invalid/');
    const hash = manifest[url.pathname.slice(1)];
    if (!hash || url.searchParams.get('v') !== hash.slice(0, 16)) throw Error(`Invalid catalog asset: ${file}`);
  }
}
function checkDirectory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) checkDirectory(file);
    else {
      if (fs.statSync(file).size > 25 * 1024 * 1024) throw Error(`File exceeds Pages limit: ${file}`);
      if (/\.(mjs|js)$/.test(file)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    }
  }
}
checkDirectory(path.join(root, 'public'));
checkDirectory(path.join(root, 'scripts'));
if (fs.readFileSync(path.join(root, 'public/index.html'), 'utf8').includes('node_modules/')) throw Error('Public HTML still depends on node_modules');
console.log(`Verified ${Object.keys(manifest).length} original assets (${(bytes / 1024 / 1024).toFixed(1)} MiB), catalog links, JavaScript, and Pages file sizes.`);

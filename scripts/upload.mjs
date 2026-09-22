import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');
const config = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc')));
const bucket = config.r2_buckets.find(entry => entry.binding === 'SKIN_ASSETS').bucket_name;
const files = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json'))));
const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
if (!fs.existsSync(cli)) throw Error('Run npm install before uploading assets.');
const checked = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { cwd: root, stdio: 'inherit' });
if (checked.status !== 0) process.exit(checked.status || 1);
console.log(`${remote ? 'Uploading to Cloudflare R2' : 'Seeding local R2'}: ${bucket}. Original files are not compressed.`);
for (const [index, key] of files.entries()) {
  console.log(`[${index + 1}/${files.length}] ${key}`);
  const args = [cli, 'r2', 'object', 'put', `${bucket}/${key}`, '--file', path.join(root, 'r2', key),
    remote ? '--remote' : '--local', '--content-type', key.endsWith('.png') ? 'image/png' : 'application/octet-stream',
    '--cache-control', 'public, max-age=3600'];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All assets uploaded. You can now deploy the website.');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'GitHubSource');
const files = ['.gitignore', 'LICENSE', 'README.md', 'package.json', 'package-lock.json',
  'wrangler.jsonc', 'asset-manifest.json', 'Cloudflare.bat', 'Start SkinForge.bat',
  'Update Site.bat', 'Prepare GitHub.bat', '.github/workflows/check.yml'];
function safePath(base, relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) throw Error('Unsafe export path');
  let current = base;
  for (const part of relative.split(/[\\/]/)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(`Symbolic links are not exported: ${relative}`);
  }
  return current;
}
function collect(directory) {
  for (const entry of fs.readdirSync(safePath(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relative = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error(`Symbolic link: ${relative}`);
    if (entry.isDirectory()) collect(relative);
    else files.push(relative);
  }
}
// Only these source directories and manifest-listed assets can be exported.
collect('public'); collect('scripts');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json')));
files.push(...Object.keys(manifest).map(file => `r2/${file}`));
safePath(root, 'GitHubSource');
let bytes = 0;
for (const relative of files) {
  const source = safePath(root, relative);
  safePath(output, relative);
  const size = fs.statSync(source).size;
  if (size >= 100 * 1024 * 1024) throw Error(`GitHub requires Git LFS for this file: ${relative}`);
  if (!relative.startsWith('r2/')) {
    const text = fs.readFileSync(source, 'utf8');
    if (/https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]{30,}/.test(text)) throw Error(`Possible private webhook in ${relative}. Export stopped.`);
  }
  bytes += size;
}
const check = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { cwd: root, stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
for (const relative of files) {
  const destination = safePath(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(safePath(root, relative), destination);
}
if (!fs.existsSync(path.join(output, '.git'))) {
  const git = spawnSync('git', ['init', '-b', 'main', output], { stdio: 'inherit', windowsHide: true });
  if (git.error || git.status !== 0) console.log('Create the repository in GitHub Desktop when adding this folder.');
}
console.log(`Prepared ${files.length} files (${(bytes / 1024 / 1024).toFixed(1)} MiB) in ${output}`);
console.log('Includes original R2 assets. Dependencies, private environment files and Cloudflare state were excluded.');
console.log('No commit, remote upload or deployment was performed.');

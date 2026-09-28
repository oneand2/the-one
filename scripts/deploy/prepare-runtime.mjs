import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || '/app';
const runtime = join(root, 'runtime');
mkdirSync(runtime, { recursive: true });
// Traced dependencies get a stable layer independent from application code.
for (const name of readdirSync(join(root, '.next/standalone'))) {
  if (name !== 'node_modules') cpSync(join(root, '.next/standalone', name), join(runtime, name), { recursive: true });
}
// A new build ID must not force unchanged fonts/JS/CSS to be downloaded again.
const stable = new Set(['chunks', 'css', 'media']);
for (const name of stable) mkdirSync(join(root, 'static', name), { recursive: true });
mkdirSync(join(runtime, '.next/static'), { recursive: true });
for (const name of readdirSync(join(root, '.next/static'))) {
  const target = stable.has(name) ? join(root, 'static', name) : join(runtime, '.next/static', name);
  cpSync(join(root, '.next/static', name), target, { recursive: true });
}
// Server common chunks can also stay unchanged when one route changes.
const chunks = join(runtime, '.next/server/chunks');
mkdirSync(join(root, 'server-chunks'), { recursive: true });
if (existsSync(chunks)) {
  cpSync(chunks, join(root, 'server-chunks'), { recursive: true });
  rmSync(chunks, { recursive: true });
}

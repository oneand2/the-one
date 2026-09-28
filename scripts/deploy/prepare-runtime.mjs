import { cpSync, mkdirSync, readdirSync } from 'node:fs';
// Keep traced dependencies in their own stable Docker layer. Copying all of
// standalone together would retransmit them on every server-code change.
mkdirSync('/app/runtime', { recursive: true });
for (const name of readdirSync('/app/.next/standalone')) {
  if (name !== 'node_modules') cpSync(`/app/.next/standalone/${name}`, `/app/runtime/${name}`, { recursive: true });
}

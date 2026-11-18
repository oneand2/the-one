import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const date = process.argv[2];
const requireMinimum = process.argv.includes('--require-minimum');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('用法：verify-news-edition.mjs YYYY-MM-DD [--require-minimum]');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '../..');
const child = spawn(process.execPath, ['scripts/publish-news-edition.mjs', '--read', '--date', date], {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const stdout = [];
const stderr = [];
child.stdout.on('data', (chunk) => stdout.push(chunk));
child.stderr.on('data', (chunk) => stderr.push(chunk));

const code = await new Promise((resolveCode, reject) => {
  child.once('error', reject);
  child.once('close', resolveCode);
});
const errorText = Buffer.concat(stderr).toString('utf8');
if (code !== 0) {
  const line = errorText.split('\n').find((item) => item.trim()) || '读取刊期失败';
  console.error(line);
  process.exit(1);
}
if (!errorText.includes('已刊发')) {
  console.error('云端稿件尚未签发');
  process.exit(1);
}

const issue = JSON.parse(Buffer.concat(stdout).toString('utf8'));
const counts = { lead: 0, selected: 0, brief: 0 };
for (const story of issue.stories ?? []) {
  if (story.placement in counts) counts[story.placement] += 1;
}
console.log(`刊期 ${date}：头版 ${counts.lead}，选读 ${counts.selected}，短讯 ${counts.brief}，已刊发`);
for (const story of issue.stories ?? []) {
  console.log(`- ${story.placement} ${story.title}`);
}
if (requireMinimum && (counts.lead < 1 || counts.selected < 3 || counts.brief < 3)) {
  console.error('篇数低于头版 1、选读 3、短讯 3 的下限');
  process.exit(1);
}

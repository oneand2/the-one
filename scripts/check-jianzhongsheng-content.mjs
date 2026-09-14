import { readFile } from 'node:fs/promises';

const contentPath = new URL('../src/content/jianzhongsheng.ts', import.meta.url);
const source = await readFile(contentPath, 'utf8');
const ageAtOpening = String.raw`(?:我(?:今年)?|今年(?:我)?)?[零〇一二三四五六七八九十百两0-9]{1,4}岁(?:以后)?`;
const checks = [
  {
    label: 'excerpt',
    pattern: new RegExp(String.raw`excerpt:\s*['\x60](${ageAtOpening})(?=[，,、。\s])`, 'g'),
  },
  {
    label: 'body',
    pattern: new RegExp(String.raw`body:\s*\x60\s*(${ageAtOpening})(?=[，,、。\s])`, 'g'),
  },
];

const violations = [];

for (const { label, pattern } of checks) {
  for (const match of source.matchAll(pattern)) {
    const line = source.slice(0, match.index).split('\n').length;
    violations.push(`${label} 第 ${line} 行以年龄“${match[1]}”开头`);
  }
}

if (violations.length > 0) {
  console.error('“见众生”内容检查失败：禁止把年龄当作手记或摘要的模板化开头。');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('“见众生”内容检查通过。');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const createFont = require('next/dist/compiled/@next/font/dist/fontkit').default;

test('news serif ships a complete regular face rather than a daily text subset', () => {
  const font = createFont(readFileSync(new URL('../sites/yijian-daily/dist/fonts/noto-serif-sc-400.woff2', import.meta.url)));
  assert.equal(font['OS/2'].usWeightClass, 400);
  assert.deepEqual(font.variationAxes, {});
  assert.ok(font.characterSet.length >= 30000, 'Keep the full Chinese font; future editions must not depend on a daily glyph subset.');

  // The reported mixed-weight headlines combine CJK, Latin, numbers and punctuation.
  const samples = '千问四代旗舰模型开放试用，百度推出文心5.5Flash预览版'
    + '西门子能源年度净利润增至41亿欧元，拟提高股息'
    + '甬舟铁路金塘海底隧道舟山侧完成掘进6.27公里'
    + '上海龙美术馆展出约150件作品，回顾1979至1989'
    + '创业板指收涨3.11%，光通信股领涨'
    + '俄乌就新一轮大规模换俘达成原则协议Qwen4-Max';
  const missing = [...new Set(samples)].filter(character => !font.hasGlyphForCodePoint(character.codePointAt(0)));
  assert.deepEqual(missing, [], 'Every headline character must come from the same regular face.');
});

test('homepage news headline uses simplified songti regular, not a partial mincho', () => {
  const css = readFileSync(new URL('../src/components/NewsEditionCard.module.css', import.meta.url), 'utf8');
  const headline = css.slice(css.indexOf('.headline {'));
  const rule = headline.slice(0, headline.indexOf('}'));
  assert.match(css, /local\("Songti SC Regular"\)/);
  assert.match(css, /local\("STSongti-SC-Regular"\)/);
  assert.match(rule, /font-family:\s*"Songti SC Text", "Songti SC", "STSong", "SimSun", serif/);
  assert.match(rule, /font-weight:\s*400/);
  assert.match(rule, /font-synthesis:\s*none/);
  assert.doesNotMatch(css, /Hiragino Mincho/);
  assert.doesNotMatch(css, /JTD News Serif|noto-serif-sc/);
  assert.match(css, /\.brand\s*\{[^}]*var\(--ui-font-kaiti\)/);
  assert.match(css, /\.issue\s*\{[^}]*var\(--ui-font-sans\)/);
  assert.match(css, /font:\s*400 12px\/1\.5 var\(--ui-font-sans\)/);
});

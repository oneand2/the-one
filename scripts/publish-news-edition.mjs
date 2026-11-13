// Node's publisher is server-side only. Never import this file from the news UI.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns';
import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { isIPv4 } from 'node:net';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import imageSize from 'next/dist/compiled/image-size/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TABLE = 'jtd_news_editions';
const BUCKET = 'jtd-news-photos';
const MEDIA = '/api/news/media/';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAX_PHOTO = 6 * 1024 * 1024;
const MAX_EDITION = 64 * 1024 * 1024;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireThat = (test, message) => { if (!test) throw new Error(message); };
const hasText = (value) => typeof value === 'string' && value.trim() !== '';
const validDate = (date) => DATE.test(date) && new Date(date + 'T12:00:00Z').toJSON()?.slice(0, 10) === date;
const fields = (value, allowed, where) => {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), where + ' 必须是对象');
  for (const key of Object.keys(value)) requireThat(allowed.includes(key), where + ' 含未识别字段：' + key);
};
function checkURL(value, where) {
  let url;
  try { url = new URL(value); } catch {}
  requireThat(hasText(value) && url && /^https?:$/.test(url.protocol) && !url.username && !url.password && !/\s/u.test(value), where + ' 需要有效的 HTTP(S) 来源链接');
  return url;
}

function checkCopy(issue, date) {
  fields(issue, ['date','lunar','description','stories'], '刊期');
  requireThat(validDate(date) && (!issue.date || issue.date === date), '需要一致的有效刊期 YYYY-MM-DD');
  requireThat(hasText(issue.lunar) && (!('description' in issue) || hasText(issue.description)), '请填写农历和有效的刊期说明');
  requireThat(Array.isArray(issue.stories) && issue.stories.length, '没有报道');
  const ids = new Set();
  for (const s of issue.stories) {
    fields(s, ['id','placement','category','section','city','title','deck','paragraphs','sources','photo','coverPhrases','previousStory'], '报道');
    for (const field of ['id','section','city','title','deck']) requireThat(hasText(s[field]), '报道缺少 ' + field);
    requireThat(ID.test(s.id) && !ids.has(s.id), '不合规或重复的报道 id：' + s.id);
    ids.add(s.id);
    requireThat(['lead','selected','brief'].includes(s.placement) && ['国际','科技','金融','民生','艺术'].includes(s.category), s.id + ' 的版面或分类无效');
    requireThat(Array.isArray(s.paragraphs) && s.paragraphs.length && s.paragraphs.every(hasText), s.id + ' 需要正文');
    if ('coverPhrases' in s) requireThat(Array.isArray(s.coverPhrases) && s.coverPhrases.every(hasText) && s.coverPhrases.join('').replace(/\s/gu,'') === s.title.replace(/\s/gu,''), s.id + ' 的断句与标题不符');
    requireThat(Array.isArray(s.sources) && s.sources.length, s.id + ' 缺少来源');
    for (const ref of s.sources) {
      requireThat(Array.isArray(ref) && ref.length === 2 && hasText(ref[0]), s.id + ' 的来源格式不正确');
      checkURL(ref[1], s.id);
    }
    fields(s.photo, ['src','alt','caption','credit','sourceUrl','label','width','height','license','licenseUrl'], s.id + ' 的配图');
    for (const field of ['src','alt','caption','credit','label']) requireThat(hasText(s.photo[field]), s.id + ' 的配图缺少 ' + field);
    for (const field of ['width','height']) requireThat(Number.isSafeInteger(s.photo[field]) && s.photo[field] > 0, s.id + ' 需要配图尺寸');
    checkURL(s.photo.sourceUrl, s.id + ' 的配图');
    if ('license' in s.photo || 'licenseUrl' in s.photo) {
      requireThat(hasText(s.photo.license), s.id + ' 缺少图片许可名称');
      checkURL(s.photo.licenseUrl, s.id + ' 的图片许可');
    }
    if ('previousStory' in s) {
      const parts = typeof s.previousStory === 'string' ? s.previousStory.split('/') : [];
      requireThat(parts.length === 2 && validDate(parts[0]) && parts[0] < date && ID.test(parts[1]), s.id + ' 的往期链接无效');
    }
  }
}

async function capped(stream, limit, label) {
  const chunks = [];
  let n = 0;
  for await (const chunk of stream) {
    n += chunk.length;
    requireThat(n <= limit, label + ' 超过大小限制');
    chunks.push(chunk);
  }
  requireThat(n > 0, label + ' 为空');
  return Buffer.concat(chunks);
}

// Pin each fetch (including each redirect) to the checked address. The ingestion
// command may run on a cloud host: photo URLs must never reach its private network.
function publicIPv4(ip) {
  if (!isIPv4(ip)) return false;
  const [a,b] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) ||
    (a === 198 && [18,19].includes(b)));
}
async function fetchPhoto(value, redirects = 0) {
  const url = checkURL(value, '配图');
  requireThat(url.protocol === 'https:' && !url.port && !url.hostname.includes(':') &&
    (!isIPv4(url.hostname) || publicIPv4(url.hostname)), '图片直链须使用公网 HTTPS 地址');
  requireThat(redirects <= 4, '配图重定向次数过多');
  const response = await new Promise((res, rej) => {
    const req = httpsGet(url, {
      signal: AbortSignal.timeout(25000), agent: false, family: 4, autoSelectFamily: false,
      lookup: (host, _options, callback) => lookup(host, { family: 4 }, (err, addr) =>
        callback(err || (!publicIPv4(addr) ? new Error('图片主机没有公网 IPv4 地址') : null), addr, 4)),
      headers: { Accept: 'image/jpeg,image/webp,image/png', 'User-Agent': 'JianTiandi-Edition/1.0' },
    }, res);
    req.on('error', rej);
  });
  try {
    if ([301,302,303,307,308].includes(response.statusCode)) {
      requireThat(response.headers.location, '图片重定向缺少地址');
      return fetchPhoto(new URL(response.headers.location, url).href, redirects + 1);
    }
    requireThat(response.statusCode === 200, '原图下载失败：HTTP ' + response.statusCode);
    const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    requireThat(Object.values(MIME).includes(type) || type === 'application/octet-stream', '直链未返回支持的图片；请勿填写报道网页');
    return await capped(response, MAX_PHOTO, '配图');
  } finally { response.destroy(); }
}

async function loadPhoto(src, options, date, cloud) {
  if (src.startsWith(MEDIA)) {
    const key = src.slice(MEDIA.length);
    requireThat(key.startsWith(date + '/') && /^\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(key), '只能引用同一期已经保存的配图');
    return download(cloud(), key);
  }
  if (src.startsWith('https://')) return fetchPhoto(src);
  requireThat(options['assets-dir'] && !isAbsolute(src) && !src.includes('\\') && !src.includes(':') && !src.split('/').includes('..'), '本地配图需提供 --assets-dir 并使用相对路径；也可填写 HTTPS 原图直链');
  const base = await realpath(options['assets-dir']);
  const file = await realpath(resolve(base, src));
  const rel = relative(base, file);
  requireThat(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), '配图路径越出素材目录');
  return capped(createReadStream(file), MAX_PHOTO, '配图');
}

export async function prepare(issue, date, options, cloud) {
  checkCopy(issue, date);
  const stories = structuredClone(issue.stories);
  const files = new Map(), seen = new Map();
  let n = 0;
  for (const {id, photo} of stories) {
    let info = seen.get(photo.src);
    if (!info) {
      const bytes = await loadPhoto(photo.src, options, date, cloud);
      let size;
      try { size = imageSize(bytes); } catch {}
      requireThat(size && Object.hasOwn(MIME, size.type), id + ' 不是受支持的 JPEG、PNG 或 WebP 图像');
      const ext = size.type;
      const complete = ext === 'jpg' ? bytes.subarray(-2).equals(Buffer.from([255,217]))
        : ext === 'png' ? bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex'))
        : bytes.length >= 12 && bytes.readUInt32LE(4) === bytes.length - 8;
      requireThat(complete, id + ' 的图片容器不完整，请换用完整原图');
      const key = date + '/' + sha(bytes) + '.' + ext;
      if (photo.src.startsWith(MEDIA)) requireThat(photo.src === MEDIA + key, id + ' 的云端配图摘要不符');
      if (!files.has(key)) {
        n += bytes.length;
        requireThat(n <= MAX_EDITION, '单期图片总量超过 64 MiB');
        files.set(key, { bytes, type: MIME[ext], stored: photo.src.startsWith(MEDIA) });
      }
      info = { size, key };
      seen.set(photo.src, info);
    }
    requireThat(photo.width === info.size.width && photo.height === info.size.height, id + ' 填写的像素与真实配图不符');
    photo.src = MEDIA + info.key;
  }
  const lead = stories.find(s => s.placement === 'lead') || stories[0];
  const cover = { title: lead.title, photo: lead.photo.src, alt: lead.photo.alt };
  if (lead.coverPhrases) cover.coverPhrases = lead.coverPhrases;
  return { fields: { issue_date: date, lunar: issue.lunar, description: issue.description || '', stories, cover }, files, bytes: n };
}

function checked({ data, error }, where) {
  if (error) throw new Error(where + '：' + (error.message || error.code || '请求失败'));
  return data;
}
async function download(db, key) {
  const blob = checked(await db.storage.from(BUCKET).download(key), '云端配图读取失败');
  requireThat(blob.size && blob.size <= MAX_PHOTO, '云端图片大小无效');
  return Buffer.from(await blob.arrayBuffer());
}
function contentOf(row) {
  const { issue_date, lunar, description, stories, cover } = row;
  return { issue_date, lunar, description, stories, cover };
}
const readRow = async (db, date) => checked(await db.from(TABLE).select('issue_date,lunar,description,stories,cover,published_at,revision').eq('issue_date', date).maybeSingle(), '读取刊期失败');
async function verifyImages(db, files, upload) {
  for (const [key, { bytes, type, stored }] of files) {
    // A cloud reference was already downloaded and hash-checked by prepare().
    // Recheck its bytes below without uploading the unchanged original again.
    if (upload && !stored) {
      const { error } = await db.storage.from(BUCKET).upload(key, bytes, { contentType: type, upsert: false, cacheControl: '31536000' });
      // Concurrent attempts may have stored this immutable object already.
      if (error && !['Duplicate','ResourceAlreadyExists','KeyAlreadyExists'].includes(error.error || error.code) &&
          !/already exists|duplicate/i.test(error.message || '')) checked({error}, '云端配图写入失败');
    }
    requireThat((await download(db, key)).equals(bytes), '云端配图回读与原图不一致：' + key);
  }
}

export async function store(db, prepared, options) {
  const { fields: content, files } = prepared;
  const date = content.issue_date;
  const row = await readRow(db, date);
  const match = row && isDeepStrictEqual(content, contentOf(row));
  const expected = options['expect-revision'];
  if (options['verify-only']) {
    requireThat(match && (!options.publish || row.published_at), date + ' 云端稿件或刊发状态与输入不符');
    await verifyImages(db, files, false);
    return '回读一致（版本 ' + row.revision + '）';
  }
  if (expected !== undefined) requireThat(row && row.revision === Number(expected), '版本已变化或刊期不存在；请先核对云端现稿');
  if (row && !match) requireThat(expected !== undefined, '该日已有不同稿件（版本 ' + row.revision + '）。更正须指定 --expect-revision 并核对旧稿');
  const publish = row?.published_at || (options.publish ? new Date().toISOString() : null);
  const refs = new Map();
  for (const story of content.stories) if (story.previousStory) {
    const [day, slug] = story.previousStory.split('/');
    if (!refs.has(day)) refs.set(day, await readRow(db, day));
    const previous = refs.get(day);
    requireThat(previous?.stories.some(s => s.id === slug) && (!publish || previous.published_at), story.id + ' 指向不存在或未刊发的前情');
  }
  await verifyImages(db, files, !match);
  let action = '已存在，内容一致';
  if (!row) {
    const { error } = await db.from(TABLE).insert({ ...content, published_at: publish });
    if (error && error.code !== '23505') checked({error}, '新刊写入失败');
    action = error ? '并发写入，已核对' : '已入库';
  } else if (!match || publish !== row.published_at) {
    const data = checked(await db.from(TABLE).update({ ...content, published_at: publish }).eq('issue_date', date).eq('revision', row.revision).select('revision'), '更正或刊发失败');
    requireThat(data?.length === 1, '他人已更改刊期；请先核对现稿');
    action = match ? '已签发' : '已更正';
  }
  const final = await readRow(db, date);
  requireThat(final && isDeepStrictEqual(contentOf(final), content) && (!publish || final.published_at), '云端回读不符；同日可能存在并发更改，请核对');
  return action + '，' + (final.published_at ? '已刊发' : '私有草稿') + '（版本 ' + final.revision + '）';
}

async function main() {
  const { values: options } = parseArgs({ options: {
    file: {type:'string'}, date: {type:'string'}, 'assets-dir': {type:'string'}, publish: {type:'boolean'},
    'dry-run': {type:'boolean'}, 'verify-only': {type:'boolean'}, 'expect-revision': {type:'string'}, read: {type:'boolean'}, help: {type:'boolean'},
  } });
  if (options.help) {
    console.log('node scripts/publish-news-edition.mjs [--file YYYY-MM-DD.json | --date YYYY-MM-DD < 稿件] [--assets-dir 素材根目录] [--dry-run | --verify-only] [--publish] [--expect-revision N]\n不提供 --file 时从标准输入读取。默认保存私有草稿，--publish 签发。已有已刊内容更正后仍保持已刊。\n只读：--read --date YYYY-MM-DD 从云端将可编辑稿件输出到 stdout，版本输出到 stderr。');
    return;
  }
  let db;
  const cloud = () => {
    if (db) return db;
    dotenv.config({ path: resolve(ROOT, '.env.local'), quiet: true });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    requireThat(url && key, '服务端缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return db;
  };
  if (options.read) {
    requireThat(validDate(options.date) && Object.keys(options).every(k => ['read','date'].includes(k)), '读取现稿仅需 --read --date YYYY-MM-DD');
    const row = await readRow(cloud(), options.date);
    requireThat(row, '该日没有已保存的刊期');
    const issue = { date: row.issue_date, lunar: row.lunar, ...(row.description ? {description:row.description} : {}), stories: row.stories };
    console.error(options.date + ' 云端现稿：版本 ' + row.revision + (row.published_at ? '，已刊发' : '，草稿'));
    console.log(JSON.stringify(issue, null, 2));
    return;
  }
  requireThat(!(options['dry-run'] && options['verify-only']), '--dry-run 和 --verify-only 不能同时使用');
  requireThat(options['expect-revision'] === undefined || (/^[1-9]\d*$/.test(options['expect-revision']) && Number.isSafeInteger(Number(options['expect-revision']))), '--expect-revision 需要正整数');
  const file = options.file && options.file !== '-' ? options.file : null;
  requireThat(file || !process.stdin.isTTY, '请指定 --file 或从标准输入传入稿件');
  const issue = JSON.parse((await capped(file ? createReadStream(file) : process.stdin, 2 * 1024 * 1024, '稿件')).toString('utf8'));
  const fromFile = file ? basename(file, '.json') : null;
  const date = options.date || issue.date || fromFile;
  requireThat(!fromFile || !DATE.test(fromFile) || fromFile === date, '指定日期与文件名不符');
  const prepared = await prepare(issue, date, options, cloud);
  const message = options['dry-run'] ? '预检通过，未写入' : await store(cloud(), prepared, options);
  console.log(date + '：' + message + '；' + prepared.fields.stories.length + ' 篇，' + prepared.files.size + ' 张配图，' + prepared.bytes + ' 字节。');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error('出刊未完成：' + error.message); process.exitCode = 1; });
}

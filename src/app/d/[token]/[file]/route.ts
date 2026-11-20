import { APK_TYPE, PRIVATE_DOWNLOAD_BUCKET, findPrivateDownload, privateDownloadPart } from '@/lib/privateDownloads';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

type Ctx = { params: Promise<{ token: string; file: string }> };

async function resolve(ctx: Ctx) {
  const { token, file } = await ctx.params;
  const item = findPrivateDownload(token);
  return item && item.fileName === file ? { item, token } : undefined;
}

function baseHeaders(fileName: string) {
  return {
    'Content-Type': APK_TYPE,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
  };
}

// Single byte range, e.g. "bytes=100-" or "bytes=100-199"; undefined = whole file.
function parseRange(header: string | null, size: number): [number, number] | null | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : null;
}

export async function HEAD(_request: Request, ctx: Ctx) {
  const found = await resolve(ctx);
  if (!found) return notFound();
  return new Response(null, { headers: { ...baseHeaders(found.item.fileName), 'Content-Length': String(found.item.size) } });
}

export async function GET(request: Request, ctx: Ctx) {
  const found = await resolve(ctx);
  if (!found) return notFound();
  const { item, token } = found;
  const range = parseRange(request.headers.get('range'), item.size);
  if (range === null) {
    return new Response(null, { status: 416, headers: { ...baseHeaders(item.fileName), 'Content-Range': `bytes */${item.size}` } });
  }
  const [start, end] = range ?? [0, item.size - 1];

  // Work out which stored parts cover [start, end].
  const pieces: { index: number; from: number; to: number }[] = [];
  let offset = 0;
  item.parts.forEach((length, index) => {
    const from = Math.max(start, offset);
    const to = Math.min(end, offset + length - 1);
    if (from <= to) pieces.push({ index, from: from - offset, to: to - offset });
    offset += length;
  });

  const storage = createAdminClient().storage.from(PRIVATE_DOWNLOAD_BUCKET);
  let current = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          if (!reader) {
            const piece = pieces[current];
            if (!piece) { controller.close(); return; }
            const { data, error } = await storage.createSignedUrl(privateDownloadPart(token, piece.index), 60);
            if (error || !data) throw error ?? new Error('signed url unavailable');
            const response = await fetch(data.signedUrl, { headers: { Range: `bytes=${piece.from}-${piece.to}` }, cache: 'no-store' });
            if (!response.ok || !response.body) throw new Error('part unavailable');
            reader = response.body.getReader();
          }
          const { done, value } = await reader.read();
          if (done) { reader = undefined; current += 1; continue; }
          controller.enqueue(value);
          return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await reader?.cancel();
    },
  });

  const headers: Record<string, string> = { ...baseHeaders(item.fileName), 'Content-Length': String(end - start + 1) };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${item.size}`;
  return new Response(body, { status: range ? 206 : 200, headers });
}

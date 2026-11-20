import { createHash, timingSafeEqual } from 'node:crypto';

// Unlisted downloads. Only the SHA-256 of each access token is committed; the
// token itself is shared privately and also derives the storage path, so this
// public source never reveals the page URL or where the file is stored.
export type PrivateDownload = {
  tokenSha256: string;
  title: string;
  fileName: string;
  size: number;
  sha256: string;
  minAndroid: string;
  parts: number[];
};

const downloads: PrivateDownload[] = [
  {
    tokenSha256: '2993af9d25cfacf8587c107d14e850987a777b2d210b1bf962b07aa9a63d79ea',
    title: '见天地 安卓版 1.0',
    fileName: 'JianTiandi-1.0.apk',
    size: 126254219,
    sha256: '48c787b99709d9404aa0ab145fe782f3b27a9d0ec385a9b96ab4b68f6bf07343',
    minAndroid: 'Android 9',
    parts: [47185920, 47185920, 31882379],
  },
];

export const PRIVATE_DOWNLOAD_BUCKET = 'private-downloads';
export const APK_TYPE = 'application/vnd.android.package-archive';

const sha = (value: string) => createHash('sha256').update(value).digest();

export function findPrivateDownload(token: string): PrivateDownload | undefined {
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return undefined;
  const digest = sha(token);
  return downloads.find((item) => timingSafeEqual(digest, Buffer.from(item.tokenSha256, 'hex')));
}

export function privateDownloadPart(token: string, index: number) {
  return 'jiantiandi-android/' + sha('jtd-apk-object:' + token).toString('hex').slice(0, 40) + '/part-' + index;
}

export function formatSize(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

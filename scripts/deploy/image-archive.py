#!/usr/bin/env python3
"""Content-addressed Docker archives: transfer each compressed member only once.
No registry account is required; SSH authenticates transport. Both classic docker
archives and OCI-layout docker exporter archives are supported.
"""
import argparse, gzip, hashlib, json, os, pathlib, shutil, sys, tarfile, tempfile


def file_hash(handle):
    digest = hashlib.sha256()
    for chunk in iter(lambda: handle.read(1024 * 1024), b''):
        digest.update(chunk)
    return digest.hexdigest()


def safe_name(name):
    path = pathlib.PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError('Unsafe archive member')
    return str(path)


def pack(source, destination):
    root = pathlib.Path(destination)
    blobs = root / 'blobs'
    blobs.mkdir(parents=True, exist_ok=True)
    entries = []
    with tarfile.open(source, 'r:*') as archive:
        for entry in archive:
            if entry.isdir():
                continue
            if not entry.isfile():
                raise ValueError('Only regular Docker archive members are supported')
            name = safe_name(entry.name)
            with tempfile.NamedTemporaryFile(dir=root, delete=False) as output:
                temporary = pathlib.Path(output.name)
                with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0, compresslevel=6) as compressed:
                    shutil.copyfileobj(archive.extractfile(entry), compressed, 1024 * 1024)
            with temporary.open('rb') as handle:
                digest = file_hash(handle)
            size = temporary.stat().st_size
            temporary.replace(blobs / (digest + '.gz'))
            entries.append({'name': name, 'digest': digest, 'size': entry.size, 'compressed_size': size, 'mode': entry.mode})
    manifest = {'version': 1, 'entries': entries}
    (root / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
    (root / 'blob-list.txt').write_text(''.join(sorted({e['digest'] + '.gz\n' for e in entries})))
    print(json.dumps({'archive_bytes': sum(e['size'] for e in entries), 'compressed_bytes': sum(p.stat().st_size for p in blobs.iterdir()), 'members': len(entries)}))


def read_manifest(path):
    manifest = json.loads(pathlib.Path(path).read_text())
    if manifest.get('version') != 1 or not manifest.get('entries'):
        raise ValueError('Invalid image manifest')
    seen = set()
    for entry in manifest['entries']:
        name = safe_name(entry['name'])
        if name in seen or len(entry['digest']) != 64 or any(c not in '0123456789abcdef' for c in entry['digest']):
            raise ValueError('Invalid image member')
        if not isinstance(entry['size'], int) or entry['size'] < 0:
            raise ValueError('Invalid member length')
        seen.add(name)
    return manifest


def verify(manifest, blobs):
    for entry in manifest['entries']:
        path = pathlib.Path(blobs) / (entry['digest'] + '.gz')
        with path.open('rb') as handle:
            if file_hash(handle) != entry['digest']:
                raise ValueError('Image blob checksum mismatch')


def unpack(manifest_path, blobs):
    manifest = read_manifest(manifest_path)
    # Validate the complete transfer before giving Docker any input.
    verify(manifest, blobs)
    with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as archive:
        for entry in manifest['entries']:
            info = tarfile.TarInfo(entry['name'])
            info.size, info.mode = entry['size'], entry['mode']
            with gzip.open(pathlib.Path(blobs) / (entry['digest'] + '.gz'), 'rb') as source:
                archive.addfile(info, source)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['pack', 'unpack', 'verify'])
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    if args.command == 'pack':
        pack(args.source, args.destination)
    elif args.command == 'unpack':
        unpack(args.source, args.destination)
    else:
        verify(read_manifest(args.source), args.destination)

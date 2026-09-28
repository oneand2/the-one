#!/usr/bin/env python3
"""Keep live/previous releases, three newest manifests, and a seven-day cache."""
import json, pathlib, shutil, subprocess, time
root = pathlib.Path('/opt/the-one')
state = root / 'deployment'
protected = {p.read_text().strip().removeprefix('the-one-release-') for p in [state/'current', state/'previous'] if p.exists()}
releases = sorted((root/'releases').iterdir(), key=lambda p:p.stat().st_mtime, reverse=True)
protected.update(p.name for p in releases[:3])
cutoff = time.time()-7*86400
for release in releases:
    if release.name in protected or release.stat().st_mtime >= cutoff:
        continue
    # docker refuses to remove an image used by a container; never force it.
    subprocess.run(['docker','image','rm','ghcr.io/oneand2/the-one:'+release.name], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(release)
for incoming in (root/'incoming').iterdir():
    if incoming.name not in protected and incoming.stat().st_mtime < cutoff:
        shutil.rmtree(incoming)

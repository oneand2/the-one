#!/usr/bin/env python3
"""Compare with the healthy live release, not merely the preceding commit."""
import json, os, pathlib, re, subprocess, urllib.request


def needs_release(paths):
    # Only known non-runtime paths are exempt. New/unknown paths deploy by default.
    return any(not (p.startswith('docs/') or p in {'README.md', 'AGENTS.md'}) for p in paths)


def decide(event, live, paths):
    if event == 'workflow_dispatch':
        return True, 'Manual publication requested'
    if not re.fullmatch(r'[0-9a-f]{40}', live or '') or paths is None:
        return True, 'Cannot prove production is current; perform full publication'
    if needs_release(paths):
        return True, 'Runtime or deployment files differ from the healthy live release'
    return False, 'Only documentation differs from the healthy live release'


def main():
    event = os.environ.get('GITHUB_EVENT_NAME', 'push')
    live, paths = '', None
    if event != 'workflow_dispatch':
        try:
            request = urllib.request.Request('https://www.the-one-and-the-two.com/api/health', headers={'Cache-Control':'no-cache'})
            with urllib.request.urlopen(request, timeout=10) as response:
                health = json.load(response)
            live = health.get('release', '') if health.get('status') == 'ok' else ''
            if re.fullmatch(r'[0-9a-f]{40}', live):
                subprocess.run(['git','fetch','--no-tags','--depth=1','origin',live], check=True, capture_output=True, timeout=40)
                diff = subprocess.check_output(['git','diff','--name-only','--no-renames','-z',live,'HEAD'], timeout=15)
                paths = [p for p in diff.decode().split('\0') if p]
        except (OSError, ValueError, subprocess.SubprocessError):
            paths = None
    publish, reason = decide(event, live, paths)
    result = {'publish':publish, 'reason':reason, 'live_release':live, 'changed_files':paths}
    metrics = pathlib.Path(os.environ['RUNNER_TEMP'])/'metrics'
    metrics.mkdir(parents=True, exist_ok=True)
    (metrics/'plan.json').write_text(json.dumps(result)+'\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('publish='+str(publish).lower()+'\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
        output.write(reason+'\n')
    print(json.dumps(result))


if __name__ == '__main__': main()

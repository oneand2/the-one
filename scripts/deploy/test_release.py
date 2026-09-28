"""Exercise real release control flow with isolated Docker/HTTPS substitutes."""
import json, os, pathlib, shutil, subprocess, tempfile, unittest
HERE=pathlib.Path(__file__).parent
SHA='a'*40

class ReleaseTests(unittest.TestCase):
    def run_release(self, failure):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            incoming=root/'incoming'/SHA
            incoming.mkdir(parents=True)
            (root/'nginx.conf').write_text('upstream next_app { server app:3000; }\n')
            (root/'.env.production').write_text('EXISTING=value\nALIPAY_APP_ID=old\n')
            (incoming/'payment-production.env').write_text('ALIPAY_APP_ID=new\n')
            (incoming/'manifest.json').write_text('{}')
            (incoming/'registry-token').write_text('test-token')
            for name in ['cleanup.py','rollback.sh']: (incoming/name).write_text('')
            script=root/'release.sh'
            script.write_text((HERE/'release.sh').read_text().replace('root=/opt/the-one','root='+str(root)))
            mock=root/'bin';mock.mkdir()
            command=mock/'mock'
            command.write_text('''#!/usr/bin/env python3
import json,os,pathlib,sys
cmd=pathlib.Path(sys.argv[0]).name
args=sys.argv[1:]
root=pathlib.Path(os.environ['MOCK_ROOT'])
with (root/'calls').open('a') as log: log.write(cmd+' '+' '.join(args)+'\\n')
failure=os.environ['FAILURE']
if cmd in ['sleep','flock']: sys.exit(0)
if cmd=='timeout': os.execvp(args[1],args[1:])
if cmd=='curl':
    if '/api/health' in args[-1]: print(json.dumps({'release':'wrong' if failure=='cutover' else 'a'*40}))
    else: print('healthy')
    sys.exit(0)
if 'pull' in args and failure=='registry': sys.exit(1)
if args[:2]==['image','inspect']:
    print('a'*40 if 'revision' in args[-1] else 12345); sys.exit(0)
if args[0]=='inspect':
    if '--format' in args: print('nginx:1.27-alpine')
    sys.exit(0)
if args[0]=='exec' and args[2]=='node': sys.exit(1 if failure=='candidate' else 0)
if args[0]=='run' and '--rm' in args and failure=='config': sys.exit(1)
sys.exit(0)
''')
            command.chmod(0o755)
            for name in ['docker','curl','sleep','flock','timeout']: (mock/name).symlink_to(command)
            result=subprocess.run(['bash',str(script),SHA],env=os.environ|{'PATH':str(mock)+':'+os.environ['PATH'],'MOCK_ROOT':str(root),'FAILURE':failure},capture_output=True,text=True)
            if failure:
                self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertEqual((root/'nginx.conf').read_text(),'upstream next_app { server app:3000; }\n')
                self.assertEqual((root/'.env.production').read_text(),'EXISTING=value\nALIPAY_APP_ID=old\n')
                self.assertFalse((root/'deployment/current').exists())
                self.assertNotIn('rm -f the-one-app-1',(root/'calls').read_text())
            else:
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertEqual((root/'deployment/current').read_text().strip(),'the-one-release-'+SHA)
                self.assertEqual((root/'deployment/previous').read_text().strip(),'the-one-app-1')
                self.assertIn('ALIPAY_APP_ID=new',(root/'.env.production').read_text())
            self.assertFalse((incoming/'payment-production.env').exists())
            self.assertFalse((incoming/'registry-token').exists())

    def test_registry_failure_keeps_old(self): self.run_release('registry')
    def test_success(self): self.run_release('')
    def test_unhealthy_candidate_keeps_old(self): self.run_release('candidate')
    def test_invalid_nginx_keeps_old(self): self.run_release('config')
    def test_failed_https_cutover_rolls_back(self): self.run_release('cutover')

if __name__=='__main__': unittest.main()

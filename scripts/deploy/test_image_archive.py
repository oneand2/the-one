import contextlib, importlib.util, io, json, pathlib, subprocess, sys, tarfile, tempfile, unittest
spec = importlib.util.spec_from_file_location('archive', pathlib.Path(__file__).with_name('image-archive.py'))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)

    def pack(self, name, data):
        source = self.root/(name+'.tar')
        with tarfile.open(source, 'w') as tar:
            for path, content in data.items():
                member = tarfile.TarInfo(path)
                member.size = len(content)
                tar.addfile(member, io.BytesIO(content))
        target=self.root/name
        with contextlib.redirect_stdout(io.StringIO()): archive.pack(source,target)
        return target

    def test_roundtrip_and_reuse(self):
        data={'base/layer.tar': b'node-runtime'*1000, 'app/layer.tar': b'version1', 'manifest.json': b'[]'}
        a=self.pack('a',data)
        b=self.pack('b',data | {'app/layer.tar':b'version2'})
        a_blobs=set((a/'blobs').iterdir())
        self.assertEqual(len({p.name for p in a_blobs} & {p.name for p in (b/'blobs').iterdir()}),2)
        result=subprocess.run([sys.executable,str(pathlib.Path(archive.__file__)),'unpack',str(a/'manifest.json'),str(a/'blobs')],capture_output=True,check=True)
        with tarfile.open(fileobj=io.BytesIO(result.stdout)) as tar:
            self.assertEqual({entry.name:tar.extractfile(entry).read() for entry in tar},data)
        c=self.pack('c',data)
        self.assertEqual((a/'manifest.json').read_bytes(),(c/'manifest.json').read_bytes())

    def test_corruption_rejected_before_output(self):
        target=self.pack('bad',{'layer.tar':b'data'})
        next((target/'blobs').iterdir()).write_bytes(b'corrupt')
        result=subprocess.run([sys.executable,str(pathlib.Path(archive.__file__)),'unpack',str(target/'manifest.json'),str(target/'blobs')],capture_output=True)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(result.stdout,b'')

    def test_unsafe_path_rejected(self):
        for name in ['../escape','/etc/shadow','foo/../../bar']:
            with self.assertRaises(ValueError): archive.safe_name(name)

    def test_invalid_manifest_rejected(self):
        target=self.pack('valid',{'layer.tar':b'data'})
        manifest=json.loads((target/'manifest.json').read_text())
        manifest['entries']*=2
        (target/'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): archive.read_manifest(target/'manifest.json')

if __name__=='__main__': unittest.main()

import pathlib, subprocess, tempfile, unittest

class RuntimePackagingTests(unittest.TestCase):
    def test_layer_split_preserves_complete_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            files={
                '.next/standalone/server.js':'server',
                '.next/standalone/node_modules/next/index.js':'dependency',
                '.next/standalone/.next/server/app/api/health/route.js':'route',
                '.next/standalone/.next/server/app/api/health/route.js.nft.json':'trace',
                '.next/standalone/.next/server/app/page.js':'page',
                '.next/standalone/.next/server/app/index.html':'html',
                '.next/standalone/.next/server/app/index.rsc':'rsc',
                '.next/standalone/.next/server/chunks/shared.js':'shared',
                '.next/static/media/font.woff2':'font',
                '.next/static/chunks/client.js':'client',
                '.next/static/build-id/_buildManifest.js':'manifest',
            }
            for name,content in files.items():
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
            subprocess.run(['node',str(pathlib.Path(__file__).with_name('prepare-runtime.mjs')),str(root)],check=True)
            self.assertEqual((root/'runtime/server.js').read_text(),'server')
            self.assertEqual((root/'server-api/.next/server/app/api/health/route.js').read_text(),'route')
            self.assertEqual((root/'server-api/.next/server/app/api/health/route.js.nft.json').read_text(),'trace')
            self.assertEqual((root/'server-pages/.next/server/app/page.js').read_text(),'page')
            self.assertEqual((root/'runtime/.next/server/app/index.html').read_text(),'html')
            self.assertEqual((root/'runtime/.next/server/app/index.rsc').read_text(),'rsc')
            self.assertFalse((root/'runtime/.next/server/app/page.js').exists())
            self.assertEqual((root/'runtime/.next/static/build-id/_buildManifest.js').read_text(),'manifest')
            self.assertEqual((root/'server-chunks/shared.js').read_text(),'shared')
            self.assertEqual((root/'static/media/font.woff2').read_text(),'font')
            self.assertEqual((root/'static/chunks/client.js').read_text(),'client')
            self.assertTrue((root/'static/css').is_dir())
            self.assertFalse((root/'runtime/node_modules').exists())
            self.assertFalse((root/'runtime/.next/server/chunks').exists())
            for name,content in files.items(): self.assertEqual((root/name).read_text(),content)

if __name__=='__main__': unittest.main()

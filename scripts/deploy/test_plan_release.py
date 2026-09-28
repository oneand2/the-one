import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('plan', pathlib.Path(__file__).with_name('plan-release.py'))
plan=importlib.util.module_from_spec(spec);spec.loader.exec_module(plan)

class ReleasePlanTests(unittest.TestCase):
    def test_docs_only_skips(self):
        self.assertFalse(plan.decide('push','a'*40,['README.md','docs/production-deployment.md'])[0])
    def test_pending_runtime_change_is_not_hidden_by_docs_commit(self):
        self.assertTrue(plan.decide('push','a'*40,['docs/guide.md','src/app/page.tsx'])[0])
    def test_unknown_or_deployment_inputs_publish(self):
        for path in ['Dockerfile','next.config.ts','content/new.json','scripts/deploy/release.sh','.github/workflows/deploy-aliyun.yml','new-file.md']:
            self.assertTrue(plan.needs_release([path]),path)
    def test_unhealthy_or_unresolvable_baseline_publishes(self):
        for live,paths in [('',[]),('not-a-sha',[]),('a'*40,None)]:
            self.assertTrue(plan.decide('push',live,paths)[0])
    def test_manual_publication_always_runs(self):
        self.assertTrue(plan.decide('workflow_dispatch','a'*40,[])[0])

if __name__=='__main__': unittest.main()

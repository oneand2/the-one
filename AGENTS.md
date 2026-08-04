# Project instructions

## Publishing changes

- In this repository, when the user says “上传修改”, “上传”, or otherwise asks to publish completed code changes, use the established direct-release workflow.
- Commit only the files belonging to the current task directly on `main`, then push to `origin/main` so the existing GitHub automation deploys the site to Alibaba Cloud.
- Do not create a feature branch or pull request unless the user explicitly asks for one.
- Do not require the GitHub CLI (`gh`) for this workflow; use the repository's existing Git remote with standard `git` commands.
- Never include unrelated working-tree files. In particular, an unrelated untracked `tmp/` directory must remain uncommitted unless the user explicitly puts it in scope.
- After pushing, verify that the remote `main` commit matches the local commit and, when possible, confirm the automatic deployment result before reporting completion.


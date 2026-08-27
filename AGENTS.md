# Project instructions

## Frontend UI design

- Whenever the user asks to design, create, redesign, or materially revise a frontend UI, always use the project's `the-one-design` skill (`.agents/skills/the-one-design/`) as the mandatory visual standard. It defines this project's design language (宣纸水墨 · 东方留白): color tokens, typography, spacing, radii, shadows, motion, gua-glyph iconography, and component recipes.
- Use the installed `frontend-design` skill alongside it for general design craft; where the two conflict, `the-one-design` wins.
- The user does not need to mention either skill explicitly. Skip this default only when the user explicitly requests a different design workflow or says not to use it.
- If the task is only backend work, a small functional fix with no meaningful visual judgment, or a code review that does not involve UI design, this default does not apply.

## Publishing changes

- In this repository, when the user says “上传修改”, “上传”, or otherwise asks to publish completed code changes, use the established direct-release workflow.
- Commit only the files belonging to the current task directly on `main`, then push to `origin/main` so the existing GitHub automation deploys the site to Alibaba Cloud.
- Do not create a feature branch or pull request unless the user explicitly asks for one.
- Do not require the GitHub CLI (`gh`) for this workflow; use the repository's existing Git remote with standard `git` commands.
- Never include unrelated working-tree files. In particular, an unrelated untracked `tmp/` directory must remain uncommitted unless the user explicitly puts it in scope.
- After pushing, verify that the remote `main` commit matches the local commit and, when possible, confirm the automatic deployment result before reporting completion.

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

## “见众生”内容写作

- 新增或修改“见众生”示例手记时，必须先阅读 `docs/jianzhongsheng-personas.md`，并遵守其人物连续性与每日续写规则。
- 不得以“我多少岁”或“多少岁，发生了某事”作为手记或摘要的模板化开头。年龄必须有叙事必要才可自然写入文中；批量新增内容时，必须额外检查不同人物的开头句式和说话习惯是否趋同。
- 见众生内容变更后必须运行 `npm run jianzhongsheng:check`，不得绕过年龄开头检查。

## 《见天地》新闻编刊

- 编写或修改 `sites/yijian-daily` 下任何刊期的新闻，先读该站 `README.md` 的“每条新闻都要讲清前因后果”。头版、选读和短讯均须交代读者理解事件所需的起因、转折及实际影响，并核对关键事实的来源与截稿时间。
- 《见天地》用云端作为刊期档案。用 `scripts/publish-news-edition.mjs` 从标准输入交稿，来源和图片署名一并入库，真实配图直接写入项目的私有对象存储；不要在电脑上逐日保存 JSON、照片或生成离线 HTML。旧的 `news:publish` 维护另一栏目，不用于本报。

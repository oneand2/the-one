# 阿里云生产发布

生产域名：https://www.the-one-and-the-two.com 。应用代码提交 `main` 后，GitHub Actions 自动发布到现有 ECS；不需要手动构建或上传。纯文档提交会先核对线上应用是否已是最新，有待发布的应用修改仍会继续发布。

## 架构与优化

ECS 保留现有 Nginx 容器、80/443 端口、证书挂载、Docker 网络和生产环境变量。数据库继续使用现有 Supabase。Next.js 使用 standalone 输出，最终镜像只包含 Node 运行时、追踪到的运行依赖、服务端产物及公开资源。开发依赖、源文件和 `.next/cache` 不进入运行镜像。`.dockerignore` 使用构建输入白名单。

GitHub Buildx 通过 `type=gha,mode=max` 缓存构建层。依赖锁文件不变时复用安装层；代码变化仍执行 Next.js 构建，不能承诺页面级增量编译。构建过程的缓存挂载不计入最终镜像。Next.js 编译缓存通过 actions/cache 与固定版本的 buildkit-cache-dance 跨 runner 保存和恢复；锁文件、Next 配置或 Dockerfile 变化时切换缓存分组。编译缓存基线建立后，不在每次小改时重复导出整份缓存；Webpack 仍按源文件内容校验并重新编译变化的模块。缓存恢复或导出失败可退回正常完整构建；npm 安装仍由依赖镜像层缓存复用。

镜像推送 GitHub Container Registry（GHCR），ECS 使用 Docker 原生拉取，自动复用已有层并并行下载。与原来的 docker save/SSH 整包传输相比，代码小改动只下载变化的应用层。字体、前端 JS、CSS、服务端公共 chunks、API 执行代码、页面执行代码与每次变化的 HTML/RSC 和版本文件分别保存，避免仅构建编号变化就重新下载整套静态资源。SSH 仅发送发布脚本、运行配置和短期仓库凭据。

当前没有可直接使用的阿里云 ACR 账号/仓库配置；实测 ECS 可连接 GHCR，因此使用已有 GitHub 工作流权限，无需新增账号。镜像仓库认证使用每次 job 的 GITHUB_TOKEN，ECS 临时凭据在拉取结束或失败时删除，job 结束后令牌过期；没有在服务器安装永久仓库密码。GitHub 工作流权限增加 packages:write。未来配置 ACR 后，可以替换仓库地址和认证方式，健康切换逻辑不变。

## 发布与失败保护

1. 检查发布工具，构建精简镜像，保存构建缓存。
2. 上传发布脚本，由 ECS 拉取缺少的镜像层，不再打包上传整个仓库。
3. 在原 Docker 网络启动独立候选容器，旧版本持续服务。
4. 验证健康接口、提交版本、首页和未登录后台拒绝访问；保留上一版静态资源兼容已打开页面。
5. 测试候选 Nginx 配置，只替换现有 upstream，原地写入文件挂载并平滑 reload，不重启 HTTPS 入口。
6. 使用真实域名、有效证书验证新版本，成功后记录当前/上一版；切换失败自动恢复原配置和环境变量。
7. 保留上一版容器运行供回滚；再上一版容器在下一次成功后退出。保留最近三个发布记录和至少七天历史镜像，清理仅针对本项目的历史文件/镜像，不执行全局 prune。

构建与发布分成独立 job：新提交可取消尚未结束的旧构建，但不会中断已经开始的生产发布。发布仍通过 GitHub concurrency 和服务器 flock 串行化，发布前再次检查是否已有更新的 main 提交，过时版本不再上线。应用和 Nginx 保留 `unless-stopped` 重启策略。原有证书续期 timer、acme.sh 账号、TLS-ALPN 方式保持原样；脚本改为启停现有 Nginx 并与发布共享锁，避免 Compose 重新启动旧应用。证书续期本身仍会短暂停用 443，这是原有 TLS-ALPN 方式的行为，日常发布不会如此。

## 手动回滚与运维

在 ECS 执行 `sudo bash /opt/the-one/deployment/rollback.sh`，将流量切回上一健康容器，并恢复对应环境变量，保留当前 HTTPS 配置；不重新下载镜像。仅允许回退到仍在运行的版本，避免引用已清理容器。

`/opt/the-one/deployment/current` 记录当前容器，`previous` 记录回退容器。发布记录和环境快照在 `/opt/the-one/releases/<SHA>/`，权限为 root-only。`/api/health` 返回当前提交编号，不包含密钥。

现有 `docker-compose.yml` 仅作为首次部署基础设施的定义保留。日常生产应用由发布脚本管理：不要在现有生产上运行 `docker compose down`、`up --remove-orphans`，或重新复制仓库中的静态 nginx.conf 覆盖动态 upstream。维护 Nginx 配置时应保留当前 upstream。重启单个 Nginx 可使用 `docker restart the-one-nginx-1`。

GitHub 每次运行保存 `deployment-metrics-<SHA>` artifact，包括精简镜像大小、压缩总量、新下载层的压缩字节、服务器发布时间；Actions 页面包含整体耗时。冷缓存首次发布和跨境网络波动仍可能超过 1–5 分钟。

## 原始测量（2026-09-28）

优化前 ECS Docker 列表显示约 2.99 GB 存储占用；同一镜像 `docker image inspect .Size` 为 1,441,095,877 字节。两种口径不可混用。主要层为完整 node_modules 约 811 MB、整个 .next 约 477 MB，其中构建缓存约 431 MiB。public 仅约 6.6 MiB。旧工作流每次完整 docker save/gzip/SSH 上传，未配置跨 runner 的 Docker layer cache，且每次部署全局清理镜像/构建缓存并重建 Nginx。

## 首轮真实验证

2026-09-28，运行 [36386309129](https://github.com/oneand2/the-one/actions/runs/36386309129) 成功，版本 `95d542e` 已通过公开 HTTPS 检查。Docker 列表由约 2.99 GB 降为 387 MB（约减少 87%）；仓库镜像压缩层合计 117,720,175 字节。Docker/containerd 对导入的未压缩 archive 和仓库压缩内容采用不同存储表示，不能直接用两次 `.Size` 作为解压大小比较。

首轮工作流从触发到 job 完成为 6 分 52 秒，其中构建/推送 85 秒，ECS 拉取 267 秒，服务器拉取到切换完成 273 秒。首轮需下载新依赖和资源层；后续相同层由 Docker 复用。并非承诺每次网络条件下都能在 5 分钟内完成。后续每轮准确结果可在工作流 measurements artifact 查看。

进一步拆分稳定资源后，运行 [36387593705](https://github.com/oneand2/the-one/actions/runs/36387593705) 于 06:41:22–06:44:02 UTC 成功执行，共 2 分 40 秒；拉取和发布步骤 29 秒。该运行此前等待上一轮发布，若从推送触发时算起为 4 分 04 秒。还实际完成了一次“回退至上一健康版 → 恢复当前版”的生产演练，两次公开 HTTPS 均返回对应提交，39 项运行配置与生产配置文件一致，Nginx 的 HTTPS 配置除应用 upstream 外保持一致。

## 进一步缩短日常流程

- `plan-release.py` 查询健康的线上提交，再与当前 Git 树比较。仅 `docs/`、`README.md`、`AGENTS.md` 的差异允许跳过构建和发布；未知路径、运行文件、部署脚本变化均发布。
- 基线查询失败、线上不健康或无法读取旧提交时，保守执行完整发布。比较基线是线上版本，不能用上一条提交，避免上一轮失败后的一次文档提交掩盖尚未上线的代码。
- 手动 workflow_dispatch 始终请求完整流程。只改文档时，健康接口继续返回实际在运行的应用 SHA，而非将文档提交标为已上线。
- Next.js 编译缓存单独持久化；与原来的 Docker 层缓存同时生效，TypeScript 检查、静态页生成和生产健康检查继续执行。
- SSH 上传与远程命令共用一次连接，减少重复握手；连接和临时凭据在任务结束时关闭/移除。
- 结果仍保存到 GitHub artifacts：`build-metrics-<SHA>` 包含是否需要发布的判定和镜像清单，`deployment-metrics-<SHA>` 包含实际发布测量。

缓存挂载实现参考 [Docker 官方缓存说明](https://docs.docker.com/build/ci/github-actions/cache/#cache-mounts)。

进一步优化的实测记录（2026-09-28）：

- 首次编译缓存基线建立：[36396989846](https://github.com/oneand2/the-one/actions/runs/36396989846)，成功上线。
- 源码小改、命中编译缓存：[36397398106](https://github.com/oneand2/the-one/actions/runs/36397398106)。Webpack 编译 6.3 秒，构建并推送镜像 67 秒（前一流程测得 109 秒）；仅下载 1 层、2,119,525 字节。此次仓库拉取因网络耗时 40 秒，服务器发布共 50 秒，完整流程约 3 分 08 秒。与此前 2 分 55 秒的那次相比，构建更快、下载更少，但完整耗时没有更快，不能将单次构建收益等同于稳定的端到端收益。
- 本段文档提交用于验证文档专用路径：应只执行检查与线上基线比较，不构建镜像、不启动候选容器、不切换 Nginx；实际应用版本保持最后一次成功发布的源码版本。

文档专用路径已实测：[36397897901](https://github.com/oneand2/the-one/actions/runs/36397897901)，19 秒完成，镜像构建与生产部署均跳过，应用仍运行 `77d3cd6`。

# 阿里云生产发布

生产域名：https://www.the-one-and-the-two.com 。代码提交 `main` 后，GitHub Actions 自动发布到现有 ECS；不需要手动构建或上传。

## 架构与优化

ECS 保留现有 Nginx 容器、80/443 端口、证书挂载、Docker 网络和生产环境变量。数据库继续使用现有 Supabase。Next.js 使用 standalone 输出，最终镜像只包含 Node 运行时、追踪到的运行依赖、服务端产物及公开资源。开发依赖、源文件和 `.next/cache` 不进入运行镜像。`.dockerignore` 使用构建输入白名单。

GitHub Buildx 通过 `type=gha,mode=max` 缓存构建层。依赖锁文件不变时复用安装层；代码变化仍执行 Next.js 构建，不能承诺页面级增量编译。构建过程的 npm/Next 缓存挂载不计入最终镜像，也不声称跨 GitHub runner 自动保留。

最终 Docker archive 按成员压缩并计算 SHA-256。通过 SSH/rsync 只上传 ECS 缺少的内容块，ECS 校验全部校验和后在本机重组并导入镜像。Node 基础层、相同依赖和资源无需反复跨网传输。本机导入仍会读取完整精简镜像，不等于完整镜像再次上传。无须新增 ACR 账号或仓库凭据；未来有 ACR 时可替换传输环节而保留发布和回滚脚本。

## 发布与失败保护

1. 检查发布工具，构建精简镜像，保存构建缓存。
2. 上传缺少的镜像块和发布脚本，不再打包上传整个仓库。
3. 在原 Docker 网络启动独立候选容器，旧版本持续服务。
4. 验证健康接口、提交版本、首页和未登录后台拒绝访问；保留上一版静态资源兼容已打开页面。
5. 测试候选 Nginx 配置，只替换现有 upstream，原地写入文件挂载并平滑 reload，不重启 HTTPS 入口。
6. 使用真实域名、有效证书验证新版本，成功后记录当前/上一版；切换失败自动恢复原配置和环境变量。
7. 保留上一版容器运行供回滚；再上一版容器在下一次成功后退出。保留最近三个发布记录及七天缓存，清理仅针对本项目的历史文件/镜像，不执行全局 prune。

并发发布通过 GitHub concurrency 和服务器 flock 串行化，新提交不会取消正在切换的发布。应用和 Nginx 保留 `unless-stopped` 重启策略。原有证书续期服务保持原样。

## 手动回滚与运维

在 ECS 执行 `sudo bash /opt/the-one/deployment/rollback.sh`，恢复上一健康容器和该次发布前的 Nginx/环境变量；不重新下载镜像。仅允许回退到仍在运行的版本，避免引用已清理容器。

`/opt/the-one/deployment/current` 记录当前容器，`previous` 记录回退容器。发布记录和环境快照在 `/opt/the-one/releases/<SHA>/`，权限为 root-only。`/api/health` 返回当前提交编号，不包含密钥。

现有 `docker-compose.yml` 仅作为首次部署基础设施的定义保留。日常生产应用由发布脚本管理：不要在现有生产上运行 `docker compose down`、`up --remove-orphans`，或重新复制仓库中的静态 nginx.conf 覆盖动态 upstream。维护 Nginx 配置时应保留当前 upstream。重启单个 Nginx 可使用 `docker restart the-one-nginx-1`。

GitHub 每次运行保存 `deployment-metrics-<SHA>` artifact，包括精简镜像大小、压缩总量、实际传输字节、服务器发布时间；Actions 页面包含整体耗时。冷缓存首次发布和跨境网络波动仍可能超过 1–5 分钟。

## 原始测量（2026-09-28）

优化前 ECS Docker 列表显示约 2.99 GB 存储占用；同一镜像 `docker image inspect .Size` 为 1,441,095,877 字节。两种口径不可混用。主要层为完整 node_modules 约 811 MB、整个 .next 约 477 MB，其中构建缓存约 431 MiB。public 仅约 6.6 MiB。旧工作流每次完整 docker save/gzip/SSH 上传，未配置跨 runner 的 Docker layer cache，且每次部署全局清理镜像/构建缓存并重建 Nginx。

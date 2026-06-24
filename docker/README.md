# Docker 构建资源

本目录存放前端镜像所需的 Nginx 配置：

- `nginx.conf` — 由前端镜像（仓库根目录 `Dockerfile`）拷贝到容器内 `/etc/nginx/conf.d/app.conf`，配置 `/api → backend:8000` 反向代理 + SPA fallback。

> **完整的构建、运行、分发、备份说明请见仓库根目录的 [`DOCKER.md`](../DOCKER.md)。**

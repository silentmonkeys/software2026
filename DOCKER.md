# Docker 部署与分发指南

> 一份文档讲清楚：把这套系统**构建为镜像 → 在本机运行 → 离线分享给同事 / 客户 → 远程部署**。
> 仓库已包含全部 Docker 化所需文件，开箱即用。

---

## 0. 你能得到什么

执行 `docker compose up -d --build` 之后：

| 容器 | 端口 | 作用 |
| --- | --- | --- |
| `loongchip-frontend` | 宿主 **8080** → 容器 80 | Nginx 托管 Vue 构建产物，并把 `/api` 反代到后端 |
| `loongchip-backend` | 仅内部 8000（默认不暴露） | FastAPI + Gunicorn + Chroma + DashScope 调用 |

数据落到 3 个具名 volume，**升级镜像不会丢数据**：

| Volume | 容器内路径 | 内容 |
| --- | --- | --- |
| `backend_data` | `/app/data` | SQLite (`loongchip.db`) — 用户 / 工单 / 知识元数据 |
| `backend_chroma` | `/app/chroma_db` | ChromaDB 向量库 |
| `backend_uploads` | `/app/uploads` | 上传的 PDF / DOCX / TXT / MD 原始文件 |

启动后浏览器访问 **<http://localhost:8080>**，默认管理员 **`admin` / `123456`**（首次登录请改密码）。

---

## 1. 仓库中的 Docker 文件清单

```
software2026/
├── Dockerfile                # 前端镜像（多阶段：node 构建 → nginx 托管）
├── .dockerignore
├── docker-compose.yml        # 前后端编排 + 三个数据卷 + healthcheck
├── docker/
│   ├── nginx.conf            # Nginx 配置：/api → backend 反向代理 + SPA fallback
│   └── README.md             # （本文件的简版，保留作子目录入口）
└── backend/
    ├── Dockerfile            # 后端镜像（python:3.11-slim + gunicorn）
    └── .dockerignore
```

任何修改源码后重新 `docker compose up -d --build` 即可重建镜像。

---

## 2. 环境前置

| 项目 | 最低要求 |
| --- | --- |
| Docker Engine | 24+ |
| Docker Compose | v2（`docker compose` 子命令） |
| 宿主磁盘 | 约 3 GB（镜像 + 卷） |
| 网络 | 能访问 docker.io（或国内镜像）；后端运行时能访问 `dashscope.aliyuncs.com` |

> **Windows / WSL2 用户**：装 Docker Desktop，并在 _Settings → Resources → WSL Integration_ 里启用你的发行版。后续命令在 WSL 终端里运行。

---

## 3. 首次构建并启动（本机开发 / 演示）

```bash
# 1) 进入仓库根目录
cd software2026

# 2) 配置后端环境变量（最重要的是 DASHSCOPE_API_KEY）
cp backend/.env.example backend/.env
vim backend/.env
#   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
#   JWT_SECRET=请改为强随机字符串
#   其余三项 DB_URL / CHROMA_DIR / UPLOAD_DIR 不用动 —— compose 会覆盖到挂卷路径

# 3) 一键构建并启动
docker compose up -d --build

# 4) 看一下状态（backend 应该会变成 healthy）
docker compose ps

# 5) 浏览器打开
#    http://localhost:8080
#    默认账号 admin / 123456
```

构建第一次需要拉 `python:3.11-slim`、`node:20-alpine`、`nginx:1.27-alpine`，并装 npm / pip 依赖，**国内首次构建约 5–10 分钟**；后续重建几乎全是缓存命中。

### 常用运维命令

```bash
# 实时日志
docker compose logs -f backend
docker compose logs -f frontend

# 重启某个服务
docker compose restart backend

# 停止（保留数据卷）
docker compose down

# 完全清理（包括数据卷 —— 会丢用户 / 工单 / 知识库 / 向量库）
docker compose down -v

# 改了源码后重建
docker compose up -d --build

# 进入容器排查
docker compose exec backend bash
docker compose exec frontend sh
```

---

## 4. 分享分发：把镜像打包给同事或客户

适用场景：客户机房没有公网 / 拉镜像受限 / 希望直接拿到"现成产物"。

### 4.1 在你本机导出镜像

```bash
# 把两个镜像导出成单个 tar 包（约 700 MB ~ 1 GB）
docker save loongchip-backend:latest loongchip-frontend:latest \
  -o loongchip-images.tar

# 也可以分别导出
docker save loongchip-backend:latest  -o backend.tar
docker save loongchip-frontend:latest -o frontend.tar
```

### 4.2 打包"分发包"

建议把以下文件一并发给对方（U 盘 / 内网网盘 / SFTP）：

```
loongchip-dist/
├── loongchip-images.tar          # ← 上一步导出的镜像
├── docker-compose.yml            # ← 直接从仓库复制
├── docker/nginx.conf             # ← 直接从仓库复制
├── backend/.env.example          # ← 让对方填 DASHSCOPE_API_KEY
└── 部署说明.md                    # ← 本文档（或截取下面"4.3"小节）
```

**注意**：分发包**不需要**带源码、`node_modules/`、`backend/uploads/`、`backend/loongchip.db` 等运行时产物。

### 4.3 客户端导入并启动

对方拿到分发包后：

```bash
# 1) 解压到任意目录
cd loongchip-dist

# 2) 把镜像加载进本地 docker
docker load -i loongchip-images.tar
#   会输出：
#   Loaded image: loongchip-backend:latest
#   Loaded image: loongchip-frontend:latest

# 3) 配置环境变量
cp backend/.env.example backend/.env
vim backend/.env       # 填入 DASHSCOPE_API_KEY 与 JWT_SECRET

# 4) 启动（注意：用 up -d 不要加 --build，直接用 tar 里的镜像）
docker compose up -d

# 5) 验证
curl http://localhost:8080/api/health
# {"ok":true,"app":"LoongChip-Maintain"}
```

> `docker-compose.yml` 已经写了 `image: loongchip-{backend,frontend}:latest`，没有 `--build` 时 compose 优先用本地已 load 的镜像，不会去拉 docker.io。

### 4.4 暴露到内网 / 公网

默认监听 `0.0.0.0:8080`，同网段直接 `http://<服务器IP>:8080` 即可访问。
对外发布请在前面放一层反向代理（Nginx / Traefik / Caddy）做 HTTPS + 域名。

---

## 5. 升级现网部署

```bash
# A. 你自己改了源码，重新构建并发布
docker compose up -d --build

# B. 对方现网升级 —— 你给一个新的 loongchip-images.tar
docker load -i loongchip-images.tar
docker compose up -d            # compose 检测到镜像变化会自动重建容器
```

升级**不会**清空 `backend_data / backend_chroma / backend_uploads`，数据安全。
后端启动时 `run_migrations()` 会自动为已有 SQLite 表补加 FIX5 / FIX6 新增列。

---

## 6. 数据备份 / 还原 / 迁移

```bash
# === 备份 ===（在源机器上）
# 把数据卷打包成 tar.gz
docker run --rm \
  -v software2026_backend_data:/data \
  -v software2026_backend_chroma:/chroma \
  -v software2026_backend_uploads:/uploads \
  -v "$(pwd)":/backup \
  alpine sh -c "tar czf /backup/loongchip-data-$(date +%F).tar.gz /data /chroma /uploads"

# === 还原 ===（在新机器上，compose 已 up 至少一次以创建空卷）
docker compose down            # 停服务，避免占用文件
docker run --rm \
  -v software2026_backend_data:/data \
  -v software2026_backend_chroma:/chroma \
  -v software2026_backend_uploads:/uploads \
  -v "$(pwd)":/backup \
  alpine sh -c "cd / && tar xzf /backup/loongchip-data-XXXX-XX-XX.tar.gz"
docker compose up -d
```

> Compose project 名默认是当前目录名，因此 volume 实际叫 `<目录名>_backend_data`。
> 如果你的目录不是 `software2026`，把上面命令里的前缀改掉。

---

## 7. 国内网络踩坑速查

构建过程中如果遇到拉不到基础镜像 / apt / pip / npm 装包失败，下面是仓库里已经默认开启的兜底，以及补救手段。

### 7.1 仓库已默认开启的优化

| 文件 | 做了什么 |
| --- | --- |
| `backend/Dockerfile` | `apt` 切换到 `mirrors.tuna.tsinghua.edu.cn`；`pip` 切换到 `pypi.tuna.tsinghua.edu.cn` |
| `Dockerfile`（前端） | `npm config set registry https://registry.npmmirror.com` |
| `docker-compose.yml` | build 阶段加 `network: host`，规避 Docker Desktop 构建容器的 DNS 隔离 |

### 7.2 仍然拉不到基础镜像怎么办

**症状**：build 第一步报 `failed to do request: Head https://docker.m.daocloud.io/...: no such host` 或 `dial tcp: lookup ...: no such host`。

**原因**：Docker Desktop 配了无效的 `registry-mirrors` / DNS。

**修复**：Docker Desktop → _Settings → Docker Engine_，把 JSON 改成：

```json
{
  "builder": { "gc": { "defaultKeepStorage": "20GB", "enabled": true } },
  "experimental": false,
  "dns": ["8.8.8.8", "223.5.5.5", "114.114.114.114"]
}
```

点 **Apply & Restart**。如果你处于必须走代理的网络，请同时在 _Settings → Resources → Proxies_ 填好 HTTP/HTTPS 代理。

**最后手段**：手动预拉基础镜像，build 时直接用本地缓存，绕过 `registry-mirrors`：

```bash
docker pull python:3.11-slim
docker pull node:20-alpine
docker pull nginx:1.27-alpine
docker compose build
```

### 7.3 apt / pip / npm 在构建容器内 DNS 不通

仓库 `docker-compose.yml` 已经给两个 `build:` 加了 `network: host`。如果你单独使用 `docker build` 命令，请显式加：

```bash
docker build --network=host -t loongchip-backend ./backend
docker build --network=host -t loongchip-frontend .
```

---

## 8. 生产部署注意事项

| 项 | 说明 |
| --- | --- |
| **后端单 worker** | `gunicorn -w 1`：SQLite + 本地 ChromaDB 不支持多进程并发写。要横向扩展请切到 Postgres + 远端 Chroma / Qdrant，并把 worker 调高。 |
| **JWT_SECRET** | `.env.example` 的默认值仅供本地开发，生产必须改成强随机串（`openssl rand -hex 32`）。 |
| **CJK PDF 导出** | 后端镜像已内置 `fonts-noto-cjk` + `fonts-wqy-microhei`，匹配 `_render_pdf()` 字体回退链（FIX6 第 7 项），中文 PDF 导出开箱即用。 |
| **CORS** | 后端 `allow_origins=["*"]`，仅适合 demo。生产请改 `app/main.py` 的 `CORSMiddleware` 白名单。 |
| **首次启动** | 自动建表 + 跑 `run_migrations()` + 播种默认 admin（约 5–10 秒，看 `docker compose logs -f backend`）。 |
| **DashScope key 没填** | 后端能起，但 `/api/chat/query`、知识入库 embedding、KG 抽取等 LLM 路径会报错。 |
| **暴露后端调试端口** | 默认不暴露 8000；要直连后端测接口，把 `docker-compose.yml` 中 backend 的 `ports: ["8000:8000"]` 注释取消即可。 |
| **反向代理 / HTTPS** | 前面再放一层 Nginx / Traefik / Caddy 做 TLS 与域名分发，本服务自身不需要再改。 |

---

## 9. 卸载

```bash
# 停容器 + 删容器 + 删自定义网络
docker compose down

# 同时删数据卷（彻底清空）
docker compose down -v

# 删镜像
docker rmi loongchip-backend:latest loongchip-frontend:latest

# 把没用的 dangling 镜像 / 缓存一起清掉（小心：会清整个 docker 的缓存）
docker system prune -af
```

---

## 10. FAQ

**Q：为什么前端镜像里没有 `npm run dev`？**
前端镜像用多阶段构建：第一阶段（node:20-alpine）只负责 `npm run build`，第二阶段（nginx:1.27-alpine）只装静态产物。最终镜像无 Node 运行时，体积约 70 MB。

**Q：为什么后端只跑一个 worker？**
SQLite 文件锁 + Chroma 本地 store 不支持多进程并发写。要 scale，请同时换 DB 与向量库（详见 §8）。

**Q：能不能用 docker-compose v1（`docker-compose` 命令）？**
不建议。`docker-compose.yml` 里用了 v2 的 `network: host` 在 `build:` 段，v1 解析行为差异较大。请装 Compose v2。

**Q：能不能在 ARM 设备（M 系列 Mac / 树莓派 5）上跑？**
基础镜像 `python:3.11-slim` / `node:20-alpine` / `nginx:1.27-alpine` 都有 ARM64 多架构 manifest，直接 build 即可。但 `chromadb` 在 ARM 上的 wheel 偶尔缺，可能要回落到源码编译（构建时间长）。

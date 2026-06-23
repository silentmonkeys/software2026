# =========================================================
# 前端：Vue 3 + Vite + TypeScript SPA
# 多阶段构建：node 构建 → nginx 托管静态资源
# =========================================================

# ---------- Stage 1: 构建产物 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 使用国内镜像加速（容器内拿不到宿主代理，直接走 npmmirror 更稳）
RUN npm config set registry https://registry.npmmirror.com

# 先装依赖（利用缓存）
COPY package.json package-lock.json* ./
RUN npm install

# 拷贝源码并构建
COPY . .

# .env.development 仅用于 dev；这里显式声明生产环境的 VITE_API_BASE
# 通过 nginx 反向代理 /api → backend:8000，所以前端继续使用 /api 即可
ENV VITE_API_BASE=/api
RUN npm run build

# ---------- Stage 2: 静态托管 ----------
FROM nginx:1.27-alpine AS runtime

# 替换默认配置（含 /api → backend 反向代理 + history 路由 fallback）
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/app.conf

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

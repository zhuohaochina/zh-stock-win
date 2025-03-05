# 构建阶段
FROM node:18-alpine as build-stage

# 增加Node内存限制，但设置更合理的值
ENV NODE_OPTIONS="--max-old-space-size=4096"
# 使用淘宝NPM镜像加速
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

# 设置工作目录
WORKDIR /app

# 优化: 分步复制提高缓存利用率
COPY package.json package-lock.json ./
# 使用clean install提高依赖安装可靠性
RUN npm ci --silent

# 复制源代码，使用更精确的复制减少不必要的文件
COPY src ./src
COPY public ./public
COPY index.html vite.config.js .env* ./

# 构建应用，添加更多错误处理和日志
RUN echo "开始构建前端应用..." && \
    npm run build > build.log 2>&1 || \
    (echo "第一次构建失败，查看日志..." && \
     cat build.log && \
     echo "等待120秒后重试..." && \
     sleep 120 && \
     NODE_OPTIONS="--max-old-space-size=2048" npm run build)

# 生产阶段
FROM nginx:alpine as production-stage
# 从构建阶段复制构建产物
COPY --from=build-stage /app/dist /usr/share/nginx/html
# 添加自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 
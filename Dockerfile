# ---------- Stage 1: install dependencies & build the React client ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

COPY server ./server
COPY client ./client
RUN npm run build

# ---------- Stage 2: lean runtime image ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/expensesplit.db
WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
COPY server/package.json ./server/
RUN npm ci --omit=dev -w server && npm cache clean --force

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]

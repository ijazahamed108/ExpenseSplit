# Deployment

The app is a single Node process that serves the API and the built UI, with a SQLite file as its only state. Anything that can run a container (or Node 22) with a persistent disk can host it.

## Option A — Docker Compose (any VM)

```bash
git clone <repo> && cd ExpenseSplit
cp .env.example .env            # set API_KEY=<random string> for anything public
docker compose up --build -d
curl localhost:3000/api/health
```

- Image: multi-stage build → `node:22-alpine`, runs as the non-root `node` user, ~300 MB (no native modules, so it builds in under a minute).
- Data: named volume `expensesplit-data` mounted at `/data`.
- Health: Docker `HEALTHCHECK` hits `/api/health` every 30 s.
- Logs: JSON on stdout → `docker compose logs -f app` (pipe through `npx pino-pretty` for humans).
- Put Caddy/Nginx/Traefik in front for TLS, then set `ENABLE_HSTS=true`.

Upgrade: `git pull && docker compose up --build -d` (migrations run automatically on boot).

## Option B — Render / Railway / Fly.io (PaaS, Dockerfile-based)

All three detect the `Dockerfile` automatically. You need: a **persistent disk** mounted at `/data` and a few env vars.

| Setting | Value |
| --- | --- |
| Port | `3000` |
| Health check path | `/api/health` |
| Disk / volume | mount at `/data` (1 GB is plenty) |
| Env | `NODE_ENV=production`, `DATABASE_PATH=/data/expensesplit.db`, `API_KEY=<secret>`, `ENABLE_HSTS=true`, `ENABLE_DEMO_SEED=false` (or `true` for a public demo) |

Fly.io example:

```bash
fly launch --no-deploy            # accepts the Dockerfile
fly volumes create expensesplit_data --size 1
# add to fly.toml:  [mounts] source="expensesplit_data" destination="/data"
fly secrets set API_KEY=$(openssl rand -hex 24)
fly deploy
```

Because SQLite has a single writer, run **one instance** (`fly scale count 1`, Render "1 instance"). For multi-instance deployments switch to Postgres (see `docs/DATABASE.md`).

## Option C — Plain Node on a server (systemd)

```bash
# as a deploy user, Node 22.13+ installed
git clone <repo> /opt/expensesplit && cd /opt/expensesplit
npm ci && npm run build
cp .env.example .env && $EDITOR .env      # NODE_ENV=production, DATABASE_PATH=/var/lib/expensesplit/app.db
```

`/etc/systemd/system/expensesplit.service`:

```ini
[Unit]
Description=ExpenseSplit
After=network.target

[Service]
User=deploy
WorkingDirectory=/opt/expensesplit
EnvironmentFile=/opt/expensesplit/.env
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning server/src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`systemctl enable --now expensesplit`, then reverse-proxy `:3000` with Caddy (`reverse_proxy localhost:3000` gives automatic HTTPS).

## Production checklist

- [ ] `API_KEY` set (unless the instance is intentionally open)
- [ ] `ENABLE_DEMO_SEED=false` unless this is a demo box (seeding with `force=true` wipes data)
- [ ] `ENABLE_HSTS=true` once HTTPS is terminated in front
- [ ] `CORS_ORIGINS` restricted if a separately hosted frontend calls the API
- [ ] Persistent disk mounted at `DATABASE_PATH`'s directory
- [ ] Backups: cron `npm run backup -- /backups/es-$(date +%F).db` or a Litestream sidecar
- [ ] Log shipping from stdout (pino JSON is ingestible by Datadog, Loki, CloudWatch…)
- [ ] Single instance (SQLite) — or migrate to Postgres before scaling out

## Backup & restore

```bash
# backup (safe while the app is running; uses VACUUM INTO)
npm run backup -- ./backups/es-$(date +%F).db          # bare-metal
docker compose exec app node server/src/backup.js /data/backup.db && docker cp expensesplit:/data/backup.db .   # Docker

# restore
docker compose down
docker run --rm -v expensesplit-data:/data -v $PWD:/src alpine cp /src/backup-YYYY-MM-DD.db /data/expensesplit.db
docker compose up -d
```

## Observability

| Signal | Where |
| --- | --- |
| Liveness/readiness | `GET /api/health` → `{status:"ok"}` (503 when the DB cannot be queried) |
| Request logs | stdout JSON: method, url, status, `responseTime`, `req.id` (set `x-request-id` upstream to correlate) |
| Errors | `level:50` lines with stack traces; 5xx responses never leak internals |
| Rate limiting | `RateLimit-*` headers on every `/api` response |

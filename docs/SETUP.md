# Local setup guide

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **22.13 or newer** | Required for the built-in `node:sqlite` module. `node -v` to check. |
| npm | 10+ | Ships with Node |
| Docker | optional | Only for the container workflow |

No database server is needed: SQLite runs inside the Node process and stores a single file under `data/`.

## 1. Install

```bash
git clone <repo-url> ExpenseSplit
cd ExpenseSplit
npm install
```

`npm install` at the root installs both workspaces (`server/` and `client/`). The repo ships an `.npmrc` that pins the public npm registry so installs work on machines with a private registry configured.

## 2. Configure (optional)

Everything has a default. To customise:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `DATABASE_PATH` | `./data/expensesplit.db` | SQLite file (`:memory:` for ephemeral) |
| `API_KEY` | *(empty)* | When set, all `/api/v1` requests need `x-api-key` |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins (irrelevant when the API serves the UI) |
| `DEFAULT_CURRENCY` | `USD` | Default for new groups |
| `LOG_LEVEL` | `info` | pino level |
| `RATE_LIMIT_PER_MINUTE` | `300` | Per-IP limit on `/api` |
| `ENABLE_DEMO_SEED` | `true` | Allow `POST /api/v1/demo/seed` and the UI's "Load demo data" button |
| `ENABLE_HSTS` | `false` | Send HSTS / upgrade-insecure-requests. Only enable behind HTTPS |

## 3. Run in development

```bash
npm run dev
```

- API: http://localhost:3000 (restarts on file change)
- UI: http://localhost:5173 (Vite HMR; `/api` is proxied to :3000)
- Swagger UI: http://localhost:3000/api/docs

Click **Load demo data** on the empty Groups page, or run `npm run seed`.

## 4. Run like production

```bash
npm run build     # builds client/dist
npm start         # serves API + UI on http://localhost:3000
```

## 5. Run with Docker

```bash
docker compose up --build -d      # or: npm run docker:up
open http://localhost:3000
```

Data persists in the named volume `expensesplit-data`. Stop with `docker compose down` (add `-v` to delete data).

## 6. Tests & lint

```bash
npm test          # vitest: domain logic + full API flow against an in-memory DB
npm run lint
```

## Demo script (2 minutes)

1. Open the app, press **Load demo data**.
2. Top-right **Viewing as** → pick *Aisha Khan*. Note the overall balances per currency.
3. Open **Flat 4B** → *Balances* tab: net bars, and the two suggested payments that clear all debt. Toggle **Show all debts** for the raw pairwise view.
4. **+ Add expense** → try *Shares* (give one person 2) or *Percentages*; watch the live preview and the footer validation ("12.00 left to assign").
5. **Settle up** → pick a suggested payment → *Record payment*. Balances update instantly.
6. *Activity* tab shows the whole timeline; **Undo** a settlement to see it reverse.
7. Open http://localhost:3000/api/docs and call `GET /groups/{id}/balances` straight from Swagger.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` | Node is older than 22.13. Upgrade (`nvm install 22`). |
| `ExperimentalWarning: SQLite` in logs | Harmless; the npm scripts already pass `--disable-warning=ExperimentalWarning`. |
| `npm install` 403 / E401 | Your global npm registry needs login. The repo `.npmrc` forces the public registry; if you removed it, run `npm install --registry=https://registry.npmjs.org/`. |
| Port 3000 in use | `PORT=4000 npm run dev` (Vite proxy picks it up via `VITE_API_TARGET=http://localhost:4000`). |
| Browser shows "API key required" | The server has `API_KEY` set. Enter it once; it's kept in `localStorage`. |
| Want a clean slate | Stop the server and delete `data/expensesplit.db*`, or `npm run seed -- --force`. |

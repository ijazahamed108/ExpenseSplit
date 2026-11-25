# ExpenseSplit

A modern bill-splitting app: create groups, add expenses with flexible splits, see who owes whom, and settle up with the fewest payments.

- **Backend:** Node.js 22 + Express, SQLite (built-in `node:sqlite`, zero native deps), OpenAPI/Swagger UI
- **Frontend:** React 19 + Vite single-page app, served by the API in production
- **Deploy:** one `docker compose up` or any Node host; no external database to provision

```bash
git clone <this repo> && cd ExpenseSplit
npm install
npm run dev          # API on :3000, UI on :5173 (hot reload)
```

Open http://localhost:5173, click **Load demo data**, and explore. API docs live at http://localhost:3000/api/docs.

## Features

| Area | What you get |
| --- | --- |
| People & groups | Any number of people; groups with their own currency; add/remove members (removal blocked while a balance is outstanding) |
| Expenses | Payer, category, date, notes; split **equally**, by **exact amounts**, by **percentages**, or by **shares**; live split preview; edit & soft-delete |
| Balances | Net position per member, pairwise "who owes whom", and **simplified settle-up** (minimum-transfer suggestions) |
| Settlements | Record payments made outside the app, one-click from suggestions; undo from the activity feed |
| Activity | Unified timeline of expenses and payments, including deleted items |
| Perspective | "Viewing as" switcher so every screen shows *you owe / you are owed* for the chosen person |
| Money correctness | Integer-cent storage, largest-remainder rounding so splits always sum to the total, derived (never stored) balances |
| Production plumbing | Env validation, structured logs, request IDs, rate limiting, Helmet, optional API key, health check, graceful shutdown, Docker health check, tests |

## Project layout

```
ExpenseSplit/
├─ server/                 Express API (ESM)
│  ├─ src/
│  │  ├─ index.js          bootstrap + graceful shutdown
│  │  ├─ app.js            middleware, static client, Swagger UI
│  │  ├─ config.js         validated environment config
│  │  ├─ db/               SQLite connection, migrations, transactions
│  │  ├─ domain/           pure logic: money, split allocation, debt simplification
│  │  ├─ services/         use-cases over the database
│  │  ├─ routes/           HTTP routes + zod schemas
│  │  └─ docs/openapi.yaml
│  └─ test/                vitest unit + API tests
├─ client/                 React + Vite SPA
├─ docs/                   design docs (see below)
├─ Dockerfile, docker-compose.yml, .env.example
└─ package.json            npm workspaces + top-level scripts
```

## Scripts (run from the repo root)

| Command | Purpose |
| --- | --- |
| `npm run dev` | API (watch mode) + Vite dev server with proxy |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Serve API **and** built client on `PORT` (default 3000) |
| `npm run seed` | Load demo data (`npm run seed -- --force` wipes first) |
| `npm run backup -- <file>` | Consistent online backup of the SQLite database |
| `npm test` | Run the server test suite |
| `npm run lint` | ESLint for server and client |
| `npm run docker:up` / `docker:down` | Build & run with Docker Compose |

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Local setup, environment variables, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design choices and trade-offs |
| [docs/DATABASE.md](docs/DATABASE.md) | Why SQLite, schema, ledger model, migration path to Postgres |
| [docs/FLOWS.md](docs/FLOWS.md) | Flow and sequence diagrams (Mermaid) |
| [docs/API.md](docs/API.md) | Endpoint reference with curl examples |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, Render/Fly/Railway, VM, backups |

## License

MIT

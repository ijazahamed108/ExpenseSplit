# Flows

All diagrams are Mermaid and render on GitHub, in VS Code/Cursor previews and at [mermaid.live](https://mermaid.live).

## 1. End-to-end user journey

```mermaid
flowchart TD
  A([Open app]) --> B{Any people / groups?}
  B -- no --> C[Load demo data<br/>or add people]
  B -- yes --> D[Pick "Viewing as"]
  C --> D
  D --> E[Create / open a group]
  E --> F[Add expense<br/>payer · amount · split mode]
  F --> G[Server validates & computes cent-exact splits]
  G --> H[Balances tab<br/>net · pairwise · simplified]
  H --> I{Settle up?}
  I -- record payment --> J[Settlement stored]
  J --> H
  I -- later --> K[Activity feed<br/>audit trail, undo]
```

## 2. Request pipeline

```mermaid
flowchart LR
  R[Request] --> H1[helmet / cors]
  H1 --> P[JSON body ≤ 256 kB]
  P --> L[pino-http<br/>request id]
  L --> RL[rate limit<br/>per IP]
  RL --> K{API_KEY set?}
  K -- yes, header ok --> V
  K -- yes, missing --> E401[401 UNAUTHORIZED]
  K -- no --> V[zod validate<br/>params · query · body]
  V -- invalid --> E400[400 VALIDATION_ERROR]
  V --> S[service]
  S -- AppError --> EH[error handler<br/>404 / 409 / 422]
  S -- ok --> OK[JSON 200/201/204]
```

## 3. Adding an expense (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant UI as React UI
  participant API as Express route
  participant SVC as expenses.service
  participant DOM as domain/splits
  participant DB as SQLite

  UI->>UI: live preview via previewSplit()
  UI->>API: POST /groups/:id/expenses {amount, paidBy, splitType, participants}
  API->>API: zod validate body & params
  API->>SVC: createExpense(groupId, input)
  SVC->>DB: group exists? payer & participants are members?
  DB-->>SVC: ok / 404 / 422
  SVC->>DOM: toCents(amount) → computeSplits(type, cents, participants)
  DOM-->>SVC: [{userId, amountCents, shareValue}] (sums exactly to total)
  SVC->>DB: BEGIN IMMEDIATE
  SVC->>DB: INSERT expenses
  SVC->>DB: INSERT expense_splits × n
  SVC->>DB: COMMIT
  SVC-->>API: Expense (with splits, decimal amounts)
  API-->>UI: 201 Created
  UI->>API: GET balances / expenses / activity (refresh)
```

## 4. Split allocation (largest remainder)

```mermaid
flowchart TD
  S([total cents, weights]) --> R[raw_i = total × w_i / Σw]
  R --> F[floor_i = ⌊raw_i⌋]
  F --> D[remainder = total − Σ floor_i]
  D --> O[order participants by<br/>fractional part desc, index asc]
  O --> G[give 1 cent to first<br/>'remainder' participants]
  G --> E([Σ parts == total])
```

Example: 100.00 split equally 3 ways → raw 33.33̅ each → floors 33/33/33 → remainder 1 → `34, 33, 33`.

## 5. How balances are derived

```mermaid
flowchart LR
  subgraph Ledger
    E[(expenses)]
    S[(expense_splits)]
    T[(settlements)]
  end
  E -->|Σ amount where paid_by = u| PAID
  S -->|Σ amount where user = u| SHARE
  T -->|Σ amount where from = u| OUT
  T -->|Σ amount where to = u| IN
  PAID & SHARE & OUT & IN --> NET["net(u) = PAID − SHARE + OUT − IN"]
  NET --> SIMP[simplifyDebts → ≤ n−1 transfers]
  S & E -->|per debtor→payer| PAIR[pairwise debts]
  T -->|reverse direction| PAIR
  PAIR --> NETPAIR[net both directions per pair]
```

## 6. Settle-up suggestion algorithm

```mermaid
flowchart TD
  A([net per member]) --> B[creditors: net > 0, sorted desc]
  A --> C[debtors: net < 0, sorted desc by |net|]
  B & C --> D{both lists non-empty?}
  D -- no --> Z([done])
  D -- yes --> E[x = min(top debtor, top creditor)]
  E --> F[emit transfer debtor → creditor, x]
  F --> G[subtract x from both;<br/>pop whichever hits 0]
  G --> D
```

## 7. Deployment topology

```mermaid
flowchart LR
  U[Users] -->|HTTPS| LB[Platform TLS / reverse proxy]
  LB -->|HTTP :3000| C[Container: node server/src/index.js]
  C --> V[(Volume /data<br/>expensesplit.db + WAL)]
  C -. optional .-> LS[Litestream sidecar → S3]
  HC[Platform health check] -->|GET /api/health| C
```

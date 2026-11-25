# API reference

Base URL: `http://localhost:3000/api/v1` · Interactive docs: `/api/docs` · Raw spec: `/api/openapi.json`

- All bodies and responses are JSON. Amounts are decimals in the group's currency (`12.5`).
- IDs are UUIDs.
- If the server was started with `API_KEY`, add `-H "x-api-key: $API_KEY"` to every call below.
- Errors always look like `{"error":{"code":"...","message":"...","details":[...]}}`.

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` (400) | Body/params failed schema validation; `details[]` lists fields |
| `UNAUTHORIZED` (401) | Missing/invalid API key |
| `NOT_FOUND` (404) | Unknown id or route |
| `CONFLICT` (409) | Duplicate email/member, member has balance, seed on non-empty DB |
| `UNPROCESSABLE` (422) | Semantically invalid: splits don't add up, non-member payer, self-settlement |
| `RATE_LIMITED` (429) | Too many requests from one IP |

## Quick walkthrough with curl

```bash
BASE=http://localhost:3000/api/v1

# 1. People
ALICE=$(curl -s $BASE/users -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' | jq -r .id)
BOB=$(curl -s $BASE/users   -H 'Content-Type: application/json' -d '{"name":"Bob"}'   | jq -r .id)
CARA=$(curl -s $BASE/users  -H 'Content-Type: application/json' -d '{"name":"Cara"}'  | jq -r .id)

# 2. Group
GROUP=$(curl -s $BASE/groups -H 'Content-Type: application/json' \
  -d "{\"name\":\"Road trip\",\"currency\":\"EUR\",\"memberIds\":[\"$ALICE\",\"$BOB\",\"$CARA\"]}" | jq -r .id)

# 3. Expenses
curl -s $BASE/groups/$GROUP/expenses -H 'Content-Type: application/json' -d "{
  \"description\":\"Fuel\",\"amount\":90,\"paidBy\":\"$ALICE\",\"category\":\"transport\",
  \"splitType\":\"equal\",\"participants\":[{\"userId\":\"$ALICE\"},{\"userId\":\"$BOB\"},{\"userId\":\"$CARA\"}]}" | jq .splits

curl -s $BASE/groups/$GROUP/expenses -H 'Content-Type: application/json' -d "{
  \"description\":\"Pizza\",\"amount\":30,\"paidBy\":\"$BOB\",\"category\":\"food\",
  \"splitType\":\"shares\",\"participants\":[{\"userId\":\"$BOB\",\"value\":2},{\"userId\":\"$CARA\",\"value\":1}]}" | jq .splits

# 4. Balances (net, pairwise, simplified)
curl -s $BASE/groups/$GROUP/balances | jq '{members:[.members[]|{name:.user.name,net}], suggested:.suggestedSettlements}'

# 5. Settle
curl -s $BASE/groups/$GROUP/settlements -H 'Content-Type: application/json' \
  -d "{\"fromUserId\":\"$CARA\",\"toUserId\":\"$ALICE\",\"amount\":30,\"note\":\"bank transfer\"}" | jq .

# 6. Activity
curl -s "$BASE/groups/$GROUP/activity?limit=10" | jq '.[]|{type,title,amount,deleted}'
```

## Endpoints

### Health & docs

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | `{status:"ok", uptime, version}`; 503 if the DB is unreachable |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/openapi.json` | OpenAPI 3.0 document |

### Users

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/users` | — | Sorted by name |
| POST | `/users` | `{name, email?}` | Email is lower-cased and must be unique |
| GET | `/users/:id` | — | |
| PATCH | `/users/:id` | `{name?, email?}` | `email: null` clears it |
| DELETE | `/users/:id` | — | 409 if the user is in any group |
| GET | `/users/:id/balances` | — | Net per group and totals per currency |

### Groups & members

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/groups?userId=` | — | Includes `members[]` and `stats{expenseCount,totalSpent}` |
| POST | `/groups` | `{name, description?, currency?, memberIds?}` | Currency defaults to `DEFAULT_CURRENCY` and is fixed afterwards |
| GET | `/groups/:id` | — | |
| PATCH | `/groups/:id` | `{name?, description?}` | |
| DELETE | `/groups/:id` | — | Cascades to expenses, splits, settlements |
| POST | `/groups/:groupId/members` | `{userId}` | 409 if already a member |
| DELETE | `/groups/:groupId/members/:userId` | — | 409 while the member's net ≠ 0 |

### Expenses

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/groups/:groupId/expenses?limit=&offset=` | — | `{items,total,limit,offset}`, newest first |
| POST | `/groups/:groupId/expenses` | see below | 201 with computed `splits[]` |
| GET | `/expenses/:id` | — | |
| PATCH | `/expenses/:id` | any subset of the create body | Splits are recomputed; if the amount changes on an `exact` split without new participants, it falls back to `equal` |
| DELETE | `/expenses/:id` | — | Soft delete |

Create body:

```json
{
  "description": "Dinner",
  "amount": 120.5,
  "paidBy": "<userId>",
  "category": "food",
  "splitType": "equal | exact | percent | shares",
  "participants": [{ "userId": "<id>", "value": 40 }],
  "expenseDate": "2026-11-25",
  "notes": "optional"
}
```

`participants[].value` meaning per `splitType`:

| splitType | value | Rule |
| --- | --- | --- |
| `equal` | ignored | Remainder cents go to the first participants |
| `exact` | amount | Must sum to `amount` exactly |
| `percent` | percentage | Must sum to 100 (±0.01) |
| `shares` | integer weight | At least one weight > 0 |

### Settlements

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/groups/:groupId/settlements` | — | |
| POST | `/groups/:groupId/settlements` | `{fromUserId, toUserId, amount, note?, settledAt?}` | Both must be members; 422 if same person |
| DELETE | `/settlements/:id` | — | Soft delete ("undo") |

### Balances & activity

| Method | Path | Response |
| --- | --- | --- |
| GET | `/groups/:groupId/balances` | `{group, currency, totalSpent, members:[{user,paid,share,net}], pairwise:[{from,to,amount}], suggestedSettlements:[{from,to,amount}]}` |
| GET | `/groups/:groupId/activity?limit=` | `[{type:"expense"\|"settlement", id, title, amount, currency, actorId, counterpartyId, category, happenedAt, createdAt, deleted}]` |

### Demo

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/demo/seed?force=true` | Loads 5 people, 2 groups, 9 expenses, 3 settlements. 409 on a non-empty DB unless `force`. Disabled when `ENABLE_DEMO_SEED=false` |

/**
 * Ordered, append-only schema migrations. The applied version is tracked with
 * SQLite's `PRAGMA user_version`. Never edit an existing entry; add a new one.
 *
 * Design notes (see docs/DATABASE.md):
 *  - All money is stored as integer minor units (`*_cents`) to avoid float drift.
 *  - Expenses and settlements are an immutable ledger; balances are *derived* by
 *    aggregation rather than stored, which removes a whole class of drift bugs.
 *  - Expenses/settlements are soft-deleted (`deleted_at`) so history is auditable.
 */
export const migrations = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE groups (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        currency    TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE group_members (
        group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
        joined_at   TEXT NOT NULL,
        PRIMARY KEY (group_id, user_id)
      );
      CREATE INDEX idx_group_members_user ON group_members(user_id);

      CREATE TABLE expenses (
        id            TEXT PRIMARY KEY,
        group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        description   TEXT NOT NULL,
        amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
        currency      TEXT NOT NULL,
        paid_by       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        category      TEXT NOT NULL DEFAULT 'general',
        split_type    TEXT NOT NULL CHECK (split_type IN ('equal','exact','percent','shares')),
        expense_date  TEXT NOT NULL,
        notes         TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        deleted_at    TEXT
      );
      CREATE INDEX idx_expenses_group_date ON expenses(group_id, expense_date DESC, created_at DESC);
      CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);

      CREATE TABLE expense_splits (
        expense_id    TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
        share_value   REAL,
        PRIMARY KEY (expense_id, user_id)
      );
      CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);

      CREATE TABLE settlements (
        id            TEXT PRIMARY KEY,
        group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        from_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        to_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
        currency      TEXT NOT NULL,
        note          TEXT,
        settled_at    TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        deleted_at    TEXT,
        CHECK (from_user_id <> to_user_id)
      );
      CREATE INDEX idx_settlements_group ON settlements(group_id, settled_at DESC);
    `,
  },
];

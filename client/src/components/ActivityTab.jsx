import { useState } from 'react';
import { api } from '../lib/api.js';
import { categoryIcon, money, relativeTime, shortDate } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Confirm, EmptyState } from './ui.jsx';

export default function ActivityTab({ group, items, onChanged }) {
  const { userById, run } = useApp();
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return <EmptyState icon="🕒" title="Nothing has happened yet" body="Expenses and payments will show up here as they're added." />;

  const confirmUndo = async () => {
    setBusy(true);
    const ok = await run(() => api.settlements.remove(undo.id), { success: 'Settlement undone' });
    setBusy(false);
    if (ok !== undefined) {
      setUndo(null);
      onChanged();
    }
  };

  return (
    <>
      <div className="card list">
        {items.map((a) => {
          const actor = userById(a.actorId);
          const other = a.counterpartyId ? userById(a.counterpartyId) : null;
          return (
            <div key={`${a.type}-${a.id}`} className={`list-row ${a.deleted ? 'deleted' : ''}`}>
              <span className="expense-icon">{categoryIcon(a.category)}</span>
              <Avatar user={actor} size="sm" />
              <div className="list-main">
                <div className="small">
                  {a.type === 'expense' ? (
                    <>
                      <strong>{actor?.name ?? 'Someone'}</strong> added <strong>“{a.title}”</strong>
                    </>
                  ) : (
                    <>
                      <strong>{actor?.name ?? 'Someone'}</strong> paid <strong>{other?.name ?? 'someone'}</strong>
                      {a.title !== 'Settlement' && <span className="muted"> · {a.title}</span>}
                    </>
                  )}
                  {a.deleted && <span className="pill pill-sm pill-muted">deleted</span>}
                </div>
                <div className="muted small">
                  {shortDate(a.happenedAt)} · logged {relativeTime(a.createdAt)}
                </div>
              </div>
              <span className={`money ${a.deleted ? 'muted strike' : ''}`}>{money(a.amount, group.currency)}</span>
              {a.type === 'settlement' && !a.deleted && (
                <Button variant="ghost" size="sm" onClick={() => setUndo(a)}>
                  Undo
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {undo && <Confirm title="Undo this settlement?" body={`The ${money(undo.amount, group.currency)} payment will no longer count towards balances.`} confirmLabel="Undo" onConfirm={confirmUndo} onClose={() => setUndo(null)} loading={busy} />}
    </>
  );
}

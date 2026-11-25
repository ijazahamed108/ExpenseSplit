import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { CATEGORIES, categoryIcon, money, shortDate } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Confirm, EmptyState } from './ui.jsx';

export default function ExpensesTab({ group, expenses, onAdd, onEdit, onChanged }) {
  const { viewerId, userById, run } = useApp();
  const [open, setOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => (!q || e.description.toLowerCase().includes(q) || userById(e.paidBy)?.name.toLowerCase().includes(q)) && (!cat || e.category === cat));
  }, [expenses, query, cat, userById]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const key = e.expenseDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  const remove = async () => {
    setBusy(true);
    const ok = await run(() => api.expenses.remove(deleting.id), { success: 'Expense deleted' });
    setBusy(false);
    if (ok !== undefined) {
      setDeleting(null);
      onChanged();
    }
  };

  if (expenses.length === 0) {
    return <EmptyState icon="🧾" title="No expenses yet" body="Add the first bill and we'll work out who owes whom." action={<Button onClick={onAdd}>Add an expense</Button>} />;
  }

  return (
    <>
      <div className="toolbar">
        <input className="search" placeholder="Search expenses…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(([k, icon, label]) => (
            <option key={k} value={k}>
              {icon} {label}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 && <p className="muted">Nothing matches your filter.</p>}

      {grouped.map(([month, items]) => (
        <section key={month} className="month-group">
          <h4 className="month-label">{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h4>
          <div className="card list">
            {items.map((e) => {
              const payer = userById(e.paidBy);
              const mine = e.splits.find((s) => s.userId === viewerId)?.amount ?? 0;
              const iPaid = e.paidBy === viewerId;
              const myNet = iPaid ? e.amount - mine : -mine;
              const expanded = open === e.id;
              return (
                <div key={e.id} className={`expense ${expanded ? 'expanded' : ''}`}>
                  <button className="expense-row" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded}>
                    <span className="expense-date">
                      <span className="d">{e.expenseDate.slice(8, 10)}</span>
                      <span className="m">{new Date(`${e.expenseDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
                    </span>
                    <span className="expense-icon">{categoryIcon(e.category)}</span>
                    <span className="expense-main">
                      <span className="expense-title">{e.description}</span>
                      <span className="muted small">
                        {payer?.name ?? 'Someone'} paid {money(e.amount, group.currency)} · split {e.splitType} between {e.splits.length}
                      </span>
                    </span>
                    <span className="expense-right">
                      {viewerId && (e.splits.some((s) => s.userId === viewerId) || iPaid) ? (
                        <>
                          <span className={`small ${myNet > 0 ? 'pos' : myNet < 0 ? 'neg' : 'muted'}`}>{myNet > 0 ? 'you lent' : myNet < 0 ? 'you borrowed' : 'no balance'}</span>
                          <span className={`money ${myNet > 0 ? 'pos' : myNet < 0 ? 'neg' : 'muted'}`}>{myNet !== 0 ? money(Math.abs(myNet), group.currency) : '—'}</span>
                        </>
                      ) : (
                        <>
                          <span className="small muted">not involved</span>
                          <span className="money muted">—</span>
                        </>
                      )}
                    </span>
                  </button>
                  {expanded && (
                    <div className="expense-detail">
                      <div className="split-list">
                        {e.splits.map((s) => {
                          const u = userById(s.userId);
                          return (
                            <div key={s.userId} className="split-item">
                              <Avatar user={u} size="xs" />
                              <span className="grow">
                                {u?.name ?? 'Former member'}
                                {s.userId === e.paidBy && <span className="pill pill-sm">paid</span>}
                              </span>
                              <span className="muted small">
                                {e.splitType === 'percent' && s.shareValue != null && `${s.shareValue}% · `}
                                {e.splitType === 'shares' && s.shareValue != null && `${s.shareValue} share${s.shareValue === 1 ? '' : 's'} · `}
                              </span>
                              <span className="money">{money(s.amount, group.currency)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {e.notes && <p className="muted small notes">“{e.notes}”</p>}
                      <div className="expense-actions">
                        <span className="muted small">Added {shortDate(e.createdAt)}</span>
                        <span className="actions">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(e)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="danger-text" onClick={() => setDeleting(e)}>
                            Delete
                          </Button>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {deleting && <Confirm title="Delete this expense?" body={`“${deleting.description}” (${money(deleting.amount, group.currency)}) will be removed from balances. It stays visible in the activity log.`} onConfirm={remove} onClose={() => setDeleting(null)} loading={busy} />}
    </>
  );
}

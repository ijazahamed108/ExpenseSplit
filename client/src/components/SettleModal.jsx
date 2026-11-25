import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { money, todayIso } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Field, Modal } from './ui.jsx';

export default function SettleModal({ group, balances, prefill, onClose, onSaved }) {
  const { viewerId, run, userById } = useApp();
  const members = group.members;
  const first = prefill ?? balances.suggestedSettlements[0];

  const [from, setFrom] = useState(first?.from ?? (members.some((m) => m.id === viewerId) ? viewerId : members[0]?.id));
  const [to, setTo] = useState(first?.to ?? members.find((m) => m.id !== (first?.from ?? viewerId))?.id ?? '');
  const [amount, setAmount] = useState(first ? String(first.amount) : '');
  const [note, setNote] = useState('');
  const [settledAt, setSettledAt] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  // When the pair changes, suggest the outstanding amount between them.
  useEffect(() => {
    const pair = balances.pairwise.find((p) => p.from === from && p.to === to);
    if (pair && !prefill) setAmount(String(pair.amount));
  }, [from, to, balances.pairwise, prefill]);

  const owed = balances.pairwise.find((p) => p.from === from && p.to === to)?.amount;
  const reverse = balances.pairwise.find((p) => p.from === to && p.to === from)?.amount;
  const valid = from && to && from !== to && Number(amount) > 0;

  const save = async (e) => {
    e?.preventDefault();
    if (!valid) return;
    setBusy(true);
    const result = await run(() => api.settlements.create(group.id, { fromUserId: from, toUserId: to, amount: +Number(amount).toFixed(2), note: note.trim() || null, settledAt }));
    setBusy(false);
    if (result) onSaved(result);
  };

  return (
    <Modal
      title="Settle up"
      subtitle="Record a payment made outside the app (cash, UPI, bank transfer…)"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid}>
            Record payment
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="form">
        <div className="settle-pair">
          <Field label="Who paid" className="grow">
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <span className="settle-arrow">→</span>
          <Field label="Who received" className="grow">
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {from === to && <p className="field-error">Pick two different people.</p>}
        {from !== to && (
          <p className="muted small">
            {owed ? (
              <>
                {userById(from)?.name} currently owes {userById(to)?.name} <strong>{money(owed, group.currency)}</strong>.
              </>
            ) : reverse ? (
              <>
                Heads up: {userById(to)?.name} owes {userById(from)?.name} {money(reverse, group.currency)}, not the other way around.
              </>
            ) : (
              <>These two are settled up.</>
            )}
          </p>
        )}
        <div className="form-row">
          <Field label={`Amount (${group.currency})`} className="grow">
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="amount-input" autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" value={settledAt} max={todayIso()} onChange={(e) => setSettledAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Note" hint="Optional">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via UPI" maxLength={140} />
        </Field>

        {balances.suggestedSettlements.length > 0 && (
          <>
            <div className="divider" />
            <span className="field-label">Suggested payments</span>
            <div className="list compact">
              {balances.suggestedSettlements.map((s, i) => (
                <button
                  type="button"
                  key={i}
                  className="list-row clickable"
                  onClick={() => {
                    setFrom(s.from);
                    setTo(s.to);
                    setAmount(String(s.amount));
                  }}
                >
                  <Avatar user={userById(s.from)} size="sm" />
                  <span className="list-main small">
                    <strong>{userById(s.from)?.name}</strong> pays <strong>{userById(s.to)?.name}</strong>
                  </span>
                  <span className="money">{money(s.amount, group.currency)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

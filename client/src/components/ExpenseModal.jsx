import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { CATEGORIES, money, todayIso } from '../lib/format.js';
import { previewSplit } from '../lib/split.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Field, Modal, Segmented } from './ui.jsx';

const SPLIT_OPTIONS = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact amounts' },
  { value: 'percent', label: 'Percentages' },
  { value: 'shares', label: 'Shares' },
];

const HELP = {
  equal: 'Split evenly between the selected people. Leftover cents are spread one at a time so totals always match.',
  exact: 'Type exactly what each person owes. The amounts must add up to the total.',
  percent: 'Assign a percentage to each person. Percentages must add up to 100.',
  shares: 'Use weights, e.g. 2 for someone who had two portions and 1 for everyone else.',
};

export default function ExpenseModal({ group, expense, onClose, onSaved }) {
  const { viewerId, run } = useApp();
  const members = group.members;
  const isEdit = Boolean(expense);

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? (members.some((m) => m.id === viewerId) ? viewerId : members[0]?.id ?? ''));
  const [category, setCategory] = useState(expense?.category ?? 'general');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso());
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [splitType, setSplitType] = useState(expense?.splitType ?? 'equal');
  const [busy, setBusy] = useState(false);

  // participants state: { [userId]: { included: boolean, value: string } }
  const [parts, setParts] = useState(() => {
    const init = {};
    for (const m of members) {
      const split = expense?.splits.find((s) => s.userId === m.id);
      const value = split ? (expense.splitType === 'exact' ? split.amount : split.shareValue ?? (expense.splitType === 'shares' ? 1 : '')) : expense ? '' : splitType === 'shares' ? 1 : '';
      init[m.id] = { included: expense ? Boolean(split) : true, value: value === null ? '' : String(value) };
    }
    return init;
  });

  const changeSplitType = (type) => {
    setSplitType(type);
    // Reset values to sensible defaults for the new mode while keeping who is included.
    setParts((p) => {
      const n = {};
      const includedIds = members.filter((m) => p[m.id]?.included).map((m) => m.id);
      for (const m of members) {
        const included = p[m.id]?.included ?? true;
        let value = '';
        if (type === 'shares') value = '1';
        if (type === 'percent' && included && includedIds.length) value = String(+(100 / includedIds.length).toFixed(2));
        n[m.id] = { included, value };
      }
      return n;
    });
  };

  const included = members.filter((m) => parts[m.id]?.included);
  const preview = useMemo(
    () => previewSplit(splitType, amount, included.map((m) => ({ userId: m.id, value: parts[m.id].value }))),
    [splitType, amount, included, parts],
  );

  const toggle = (id) => setParts((p) => ({ ...p, [id]: { ...p[id], included: !p[id].included } }));
  const setValue = (id, value) => setParts((p) => ({ ...p, [id]: { ...p[id], value } }));
  const selectAll = (on) => setParts((p) => Object.fromEntries(members.map((m) => [m.id, { ...p[m.id], included: on }])));

  const amountNum = Number(amount);
  const valid = description.trim() && amountNum > 0 && paidBy && included.length > 0 && !preview.error;

  const save = async (e) => {
    e?.preventDefault();
    if (!valid) return;
    setBusy(true);
    const payload = {
      description: description.trim(),
      amount: +amountNum.toFixed(2),
      paidBy,
      category,
      splitType,
      expenseDate,
      notes: notes.trim() || null,
      participants: included.map((m) => ({ userId: m.id, ...(splitType !== 'equal' ? { value: Number(parts[m.id].value) || 0 } : {}) })),
    };
    const result = await run(() => (isEdit ? api.expenses.update(expense.id, payload) : api.expenses.create(group.id, payload)));
    setBusy(false);
    if (result) onSaved(result);
  };

  const unit = splitType === 'exact' ? group.currency : splitType === 'percent' ? '%' : splitType === 'shares' ? 'shares' : '';

  return (
    <Modal
      title={isEdit ? 'Edit expense' : 'Add expense'}
      subtitle={group.name}
      onClose={onClose}
      wide
      footer={
        <>
          <div className="grow">
            {preview.error ? <span className="field-error">{preview.error}</span> : amountNum > 0 && <span className="muted">Splits add up to {money(amountNum, group.currency)}</span>}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid}>
            {isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="form">
        <div className="form-row">
          <Field label="Description" className="grow">
            <input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner at Nando's" maxLength={140} />
          </Field>
          <Field label={`Amount (${group.currency})`}>
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="amount-input" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Paid by" className="grow">
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === viewerId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(([k, icon, label]) => (
                <option key={k} value={k}>
                  {icon} {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={expenseDate} max={todayIso()} onChange={(e) => setExpenseDate(e.target.value)} />
          </Field>
        </div>

        <div className="split-head">
          <span className="field-label">Split</span>
          <Segmented options={SPLIT_OPTIONS} value={splitType} onChange={changeSplitType} />
        </div>
        <p className="muted small">{HELP[splitType]}</p>

        <div className="split-table">
          <div className="split-toolbar">
            <span className="muted small">
              {included.length} of {members.length} people
            </span>
            <span className="split-toolbar-actions">
              <button type="button" className="link" onClick={() => selectAll(true)}>
                All
              </button>
              <button type="button" className="link" onClick={() => selectAll(false)}>
                None
              </button>
            </span>
          </div>
          {members.map((m) => {
            const p = parts[m.id];
            const idx = included.findIndex((x) => x.id === m.id);
            const cents = idx >= 0 ? preview.amounts[idx] ?? 0 : 0;
            return (
              <div key={m.id} className={`split-row ${p.included ? '' : 'excluded'}`}>
                <label className="split-person">
                  <input type="checkbox" checked={p.included} onChange={() => toggle(m.id)} />
                  <Avatar user={m} size="sm" />
                  <span>
                    {m.name}
                    {m.id === viewerId && <span className="muted"> (you)</span>}
                  </span>
                </label>
                {splitType !== 'equal' && p.included && (
                  <span className="split-input">
                    <input type="number" inputMode="decimal" min="0" step={splitType === 'shares' ? 1 : 0.01} value={p.value} onChange={(e) => setValue(m.id, e.target.value)} placeholder="0" />
                    <span className="muted small">{unit}</span>
                  </span>
                )}
                <span className={`split-amount ${p.included ? '' : 'muted'}`}>{p.included ? money(cents / 100, group.currency) : '—'}</span>
              </div>
            );
          })}
        </div>

        <Field label="Notes" hint="Optional">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering" maxLength={500} />
        </Field>
      </form>
    </Modal>
  );
}

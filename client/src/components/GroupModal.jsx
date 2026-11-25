import { useState } from 'react';
import { api } from '../lib/api.js';
import { CURRENCIES } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Field, Modal } from './ui.jsx';

export default function GroupModal({ group, onClose, onSaved }) {
  const { users, viewerId, run, refreshUsers } = useApp();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [currency, setCurrency] = useState(group?.currency ?? 'USD');
  const [memberIds, setMemberIds] = useState(() => new Set(group ? group.members.map((m) => m.id) : viewerId ? [viewerId] : []));
  const [newPerson, setNewPerson] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id) =>
    setMemberIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addPerson = async () => {
    const n = newPerson.trim();
    if (!n) return;
    const u = await run(() => api.users.create({ name: n }));
    if (u) {
      await refreshUsers();
      setMemberIds((s) => new Set([...s, u.id]));
      setNewPerson('');
    }
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const result = await run(() =>
      group
        ? api.groups.update(group.id, { name: name.trim(), description: description.trim() || null })
        : api.groups.create({ name: name.trim(), description: description.trim() || undefined, currency, memberIds: [...memberIds] }),
    );
    setBusy(false);
    if (result) onSaved(result);
  };

  return (
    <Modal
      title={group ? 'Edit group' : 'New group'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            {group ? 'Save' : 'Create group'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="form">
        <div className="form-row">
          <Field label="Group name" className="grow">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa trip, Flat 4B" maxLength={80} />
          </Field>
          <Field label="Currency" hint={group ? 'Fixed after creation' : undefined}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!!group}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" hint="Optional">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group for?" maxLength={280} />
        </Field>

        {!group && (
          <Field label="Members" hint="You can add or remove people later too.">
            <div className="chip-grid">
              {users.map((u) => (
                <button type="button" key={u.id} className={`chip ${memberIds.has(u.id) ? 'selected' : ''}`} onClick={() => toggle(u.id)}>
                  <Avatar user={u} size="xs" /> {u.name}
                </button>
              ))}
            </div>
            <div className="inline-add">
              <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Add a new person by name…" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPerson())} />
              <Button type="button" variant="secondary" size="sm" onClick={addPerson} disabled={!newPerson.trim()}>
                Add
              </Button>
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}

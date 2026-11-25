import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, Modal, Money } from './ui.jsx';

export default function MembersPanel({ group, balances, onClose, onChanged }) {
  const { users, run, refreshUsers } = useApp();
  const [adding, setAdding] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [busyId, setBusyId] = useState(null);

  const memberIds = new Set(group.members.map((m) => m.id));
  const candidates = users.filter((u) => !memberIds.has(u.id));
  const netOf = (id) => balances.members.find((m) => m.user.id === id)?.net ?? 0;

  const add = async (userId) => {
    if (!userId) return;
    setBusyId(userId);
    const ok = await run(() => api.groups.addMember(group.id, userId), { success: 'Member added' });
    setBusyId(null);
    setAdding('');
    if (ok) onChanged();
  };

  const createAndAdd = async () => {
    const n = newPerson.trim();
    if (!n) return;
    const u = await run(() => api.users.create({ name: n }));
    if (u) {
      await refreshUsers();
      setNewPerson('');
      add(u.id);
    }
  };

  const remove = async (userId) => {
    setBusyId(userId);
    const ok = await run(() => api.groups.removeMember(group.id, userId), { success: 'Member removed' });
    setBusyId(null);
    if (ok) onChanged();
  };

  return (
    <Modal title="Members" subtitle={`${group.members.length} people in ${group.name}`} onClose={onClose}>
      <div className="list">
        {group.members.map((m) => {
          const net = netOf(m.id);
          return (
            <div key={m.id} className="list-row">
              <Avatar user={m} />
              <div className="list-main">
                <div className="list-title">{m.name}</div>
                <div className={`small ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted'}`}>
                  {net === 0 ? 'settled up' : net > 0 ? 'is owed ' : 'owes '}
                  {net !== 0 && <Money amount={Math.abs(net)} currency={group.currency} />}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="danger-text" onClick={() => remove(m.id)} loading={busyId === m.id} disabled={net !== 0} title={net !== 0 ? 'Settle up before removing' : 'Remove from group'}>
                Remove
              </Button>
            </div>
          );
        })}
      </div>

      <div className="divider" />
      <h4>Add someone</h4>
      <div className="inline-add">
        <select value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">Choose an existing person…</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => add(adding)} disabled={!adding} loading={busyId === adding && !!adding}>
          Add
        </Button>
      </div>
      <div className="inline-add">
        <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="…or create a new person by name" onKeyDown={(e) => e.key === 'Enter' && createAndAdd()} />
        <Button variant="secondary" size="sm" onClick={createAndAdd} disabled={!newPerson.trim()}>
          Create & add
        </Button>
      </div>
    </Modal>
  );
}

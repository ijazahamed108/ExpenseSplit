import { useState } from 'react';
import { Avatar, Button, Confirm, EmptyState, Field, Modal } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';

export default function PeoplePage() {
  const { users, refreshUsers, run } = useApp();
  const [editing, setEditing] = useState(null); // null | {} | user
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const ok = await run(() => api.users.remove(removing.id), { success: `${removing.name} removed` });
    setBusy(false);
    if (ok !== undefined) {
      setRemoving(null);
      refreshUsers();
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">Everyone you split costs with. Add people here, then invite them to groups.</p>
        </div>
        <Button onClick={() => setEditing({})}>+ Add person</Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon="🙋" title="No people yet" body="Add the friends, flatmates or colleagues you share expenses with." action={<Button onClick={() => setEditing({})}>Add a person</Button>} />
      ) : (
        <div className="card list">
          {users.map((u) => (
            <div key={u.id} className="list-row">
              <Avatar user={u} />
              <div className="list-main">
                <div className="list-title">{u.name}</div>
                <div className="muted small">{u.email || 'no email'}</div>
              </div>
              <div className="actions">
                <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="danger-text" onClick={() => setRemoving(u)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PersonModal
          user={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refreshUsers();
          }}
        />
      )}
      {removing && (
        <Confirm title={`Remove ${removing.name}?`} body="People can only be removed when they are not in any group." confirmLabel="Remove" onConfirm={remove} onClose={() => setRemoving(null)} loading={busy} />
      )}
    </>
  );
}

export function PersonModal({ user, onClose, onSaved }) {
  const { run } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const payload = { name: name.trim(), email: email.trim() || (user ? null : undefined) };
    const result = await run(() => (user ? api.users.update(user.id, payload) : api.users.create(payload)), {
      success: user ? 'Saved' : `${name.trim()} added`,
    });
    setBusy(false);
    if (result) onSaved(result);
  };

  return (
    <Modal
      title={user ? 'Edit person' : 'Add person'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            {user ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="form">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" maxLength={80} />
        </Field>
        <Field label="Email" hint="Optional, must be unique">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
        </Field>
      </form>
    </Modal>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GroupModal from '../components/GroupModal.jsx';
import { AvatarStack, Button, EmptyState, Money, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';

export default function GroupsPage() {
  const { run, viewerId, users, usersLoaded, refreshUsers, toast } = useApp();
  const [groups, setGroups] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([run(() => api.groups.list()), viewerId ? run(() => api.users.balances(viewerId)) : null]);
    if (g) setGroups(g);
    setSummary(s ?? null);
  }, [run, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    const ok = await run(() => api.demo.seed(false), { success: 'Demo data loaded' });
    setSeeding(false);
    if (ok) {
      await refreshUsers();
      load();
    }
  };

  if (!groups || !usersLoaded) return <Spinner />;

  const netFor = (groupId) => summary?.groups.find((g) => g.group.id === groupId)?.net ?? 0;
  const totals = summary ? Object.entries(summary.totals) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Groups</h1>
          <p className="muted">Trips, households, teams — anything you share costs in.</p>
        </div>
        <div className="actions">
          {users.length === 0 && groups.length === 0 && (
            <Button variant="secondary" onClick={seed} loading={seeding}>
              Load demo data
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}>+ New group</Button>
        </div>
      </div>

      {totals.length > 0 && (
        <section className="summary-row">
          {totals.map(([cur, t]) => (
            <div key={cur} className="card stat-card">
              <div className="stat-label">Overall · {cur}</div>
              <div className="stat-value">
                <Money amount={t.net} currency={cur} signed />
              </div>
              <div className="stat-foot muted">
                you are owed <Money amount={t.owed} currency={cur} /> · you owe <Money amount={t.owing} currency={cur} />
              </div>
            </div>
          ))}
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No groups yet"
          body="Create a group for your next trip or household, or load a demo dataset to look around."
          action={
            <div className="actions">
              <Button variant="secondary" onClick={seed} loading={seeding}>
                Load demo data
              </Button>
              <Button onClick={() => setShowCreate(true)}>Create a group</Button>
            </div>
          }
        />
      ) : (
        <section className="grid">
          {groups.map((g) => {
            const net = netFor(g.id);
            const isMember = g.members.some((m) => m.id === viewerId);
            return (
              <Link key={g.id} to={`/groups/${g.id}`} className="card group-card">
                <div className="group-card-top">
                  <h3>{g.name}</h3>
                  <span className="pill">{g.currency}</span>
                </div>
                {g.description && <p className="muted clamp">{g.description}</p>}
                <div className="group-card-meta">
                  <AvatarStack users={g.members} />
                  <span className="muted">
                    {g.members.length} {g.members.length === 1 ? 'member' : 'members'} · {g.stats.expenseCount} expenses
                  </span>
                </div>
                <div className="group-card-foot">
                  <span className="muted">
                    Total <Money amount={g.stats.totalSpent} currency={g.currency} />
                  </span>
                  {isMember ? (
                    <span className={`balance-chip ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}`}>
                      {net > 0 ? 'you are owed' : net < 0 ? 'you owe' : 'settled up'} {net !== 0 && <Money amount={Math.abs(net)} currency={g.currency} />}
                    </span>
                  ) : (
                    <span className="balance-chip zero">not a member</span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {showCreate && (
        <GroupModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            toast('Group created', 'success');
            load();
          }}
        />
      )}
    </>
  );
}

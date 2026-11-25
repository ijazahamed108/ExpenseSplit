import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ActivityTab from '../components/ActivityTab.jsx';
import BalancesTab from '../components/BalancesTab.jsx';
import ExpenseModal from '../components/ExpenseModal.jsx';
import ExpensesTab from '../components/ExpensesTab.jsx';
import GroupModal from '../components/GroupModal.jsx';
import MembersPanel from '../components/MembersPanel.jsx';
import SettleModal from '../components/SettleModal.jsx';
import { Button, Confirm, Money, Spinner, Tabs } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { run, viewerId, toast } = useApp();

  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [activity, setActivity] = useState(null);
  const [tab, setTab] = useState('expenses');
  const [modal, setModal] = useState(null); // {type:'expense', expense?} | {type:'settle', prefill?} | {type:'edit'} | {type:'delete'} | {type:'members'}
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, b, e, a] = await Promise.all([api.groups.get(id), api.groups.balances(id), api.expenses.list(id, { limit: 200 }), api.groups.activity(id, { limit: 100 })]);
      setGroup(g);
      setBalances(b);
      setExpenses(e);
      setActivity(a);
    } catch (err) {
      if (err.status === 404) setMissing(true);
      else toast(err.message, 'error');
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (missing)
    return (
      <div className="empty">
        <h3>Group not found</h3>
        <Link to="/">Back to groups</Link>
      </div>
    );
  if (!group || !balances || !expenses || !activity) return <Spinner />;

  const me = balances.members.find((m) => m.user.id === viewerId);
  const isMember = Boolean(me);
  const canAct = group.members.length >= 1;

  const deleteGroup = async () => {
    setBusy(true);
    const ok = await run(() => api.groups.remove(group.id), { success: 'Group deleted' });
    setBusy(false);
    if (ok !== undefined) navigate('/');
  };

  const afterChange = (msg) => {
    setModal(null);
    if (msg) toast(msg, 'success');
    load();
  };

  return (
    <>
      <nav className="crumbs muted">
        <Link to="/">Groups</Link> / <span>{group.name}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>
            {group.name} <span className="pill">{group.currency}</span>
          </h1>
          {group.description && <p className="muted">{group.description}</p>}
        </div>
        <div className="actions">
          <Button variant="ghost" onClick={() => setModal({ type: 'members' })}>
            Members ({group.members.length})
          </Button>
          <Button variant="ghost" onClick={() => setModal({ type: 'edit' })}>
            Edit
          </Button>
          <Button variant="secondary" onClick={() => setModal({ type: 'settle' })} disabled={group.members.length < 2}>
            Settle up
          </Button>
          <Button onClick={() => setModal({ type: 'expense' })} disabled={!canAct}>
            + Add expense
          </Button>
        </div>
      </div>

      <section className="summary-row">
        <div className="card stat-card">
          <div className="stat-label">Total spent</div>
          <div className="stat-value">
            <Money amount={balances.totalSpent} currency={group.currency} />
          </div>
          <div className="stat-foot muted">{expenses.total} expenses</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Your balance</div>
          <div className="stat-value">{isMember ? <Money amount={me.net} currency={group.currency} signed /> : <span className="muted">—</span>}</div>
          <div className="stat-foot muted">{isMember ? (me.net > 0 ? 'you are owed' : me.net < 0 ? 'you owe' : 'you are settled up') : 'you are not in this group'}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">To settle</div>
          <div className="stat-value">{balances.suggestedSettlements.length}</div>
          <div className="stat-foot muted">{balances.suggestedSettlements.length === 0 ? 'everyone is square' : 'payments would clear all debts'}</div>
        </div>
      </section>

      <Tabs
        tabs={[
          { id: 'expenses', label: 'Expenses', count: expenses.total },
          { id: 'balances', label: 'Balances' },
          { id: 'activity', label: 'Activity' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'expenses' && (
        <ExpensesTab
          group={group}
          expenses={expenses.items}
          onAdd={() => setModal({ type: 'expense' })}
          onEdit={(expense) => setModal({ type: 'expense', expense })}
          onChanged={() => load()}
        />
      )}
      {tab === 'balances' && <BalancesTab group={group} balances={balances} onSettle={(prefill) => setModal({ type: 'settle', prefill })} />}
      {tab === 'activity' && <ActivityTab group={group} items={activity} onChanged={() => load()} />}

      <div className="danger-zone">
        <Button variant="ghost" className="danger-text" onClick={() => setModal({ type: 'delete' })}>
          Delete group
        </Button>
      </div>

      {modal?.type === 'expense' && <ExpenseModal group={group} expense={modal.expense} onClose={() => setModal(null)} onSaved={() => afterChange(modal.expense ? 'Expense updated' : 'Expense added')} />}
      {modal?.type === 'settle' && <SettleModal group={group} balances={balances} prefill={modal.prefill} onClose={() => setModal(null)} onSaved={() => afterChange('Settlement recorded')} />}
      {modal?.type === 'edit' && <GroupModal group={group} onClose={() => setModal(null)} onSaved={() => afterChange('Group updated')} />}
      {modal?.type === 'members' && <MembersPanel group={group} balances={balances} onClose={() => setModal(null)} onChanged={() => load()} />}
      {modal?.type === 'delete' && (
        <Confirm title={`Delete “${group.name}”?`} body="This permanently removes the group with all its expenses and settlements. This cannot be undone." onConfirm={deleteGroup} onClose={() => setModal(null)} loading={busy} />
      )}
    </>
  );
}

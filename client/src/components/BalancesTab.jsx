import { useState } from 'react';
import { money } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { Avatar, Button, EmptyState } from './ui.jsx';

export default function BalancesTab({ group, balances, onSettle }) {
  const { viewerId, userById } = useApp();
  const [showPairwise, setShowPairwise] = useState(false);
  const maxAbs = Math.max(1, ...balances.members.map((m) => Math.abs(m.net)));

  if (balances.members.length === 0) return <EmptyState icon="👥" title="No members" body="Add people to this group to start tracking balances." />;

  return (
    <div className="balances-layout">
      <section className="card">
        <h3 className="card-title">Net balances</h3>
        <p className="muted small">Positive means the person is owed money overall; negative means they owe.</p>
        <div className="bars">
          {balances.members.map((m) => {
            const pct = (Math.abs(m.net) / maxAbs) * 100;
            const cls = m.net > 0 ? 'pos' : m.net < 0 ? 'neg' : 'zero';
            return (
              <div key={m.user.id} className="bar-row">
                <span className="bar-person">
                  <Avatar user={m.user} size="sm" />
                  <span>
                    {m.user.name}
                    {m.user.id === viewerId && <span className="muted"> (you)</span>}
                  </span>
                </span>
                <span className="bar-track">
                  <span className={`bar-fill ${cls}`} style={{ width: `${m.net === 0 ? 0 : Math.max(pct, 2)}%` }} />
                </span>
                <span className={`bar-value money ${cls}`}>{money(m.net, group.currency, { sign: true })}</span>
                <span className="muted small bar-detail">
                  paid {money(m.paid, group.currency)} · share {money(m.share, group.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Settle up</h3>
          <button className="link" onClick={() => setShowPairwise((s) => !s)}>
            {showPairwise ? 'Show simplified' : 'Show all debts'}
          </button>
        </div>
        <p className="muted small">{showPairwise ? 'Every outstanding debt between two people, after netting both directions.' : 'The fewest payments that clear every debt in the group.'}</p>

        {(showPairwise ? balances.pairwise : balances.suggestedSettlements).length === 0 ? (
          <div className="settled">🎉 Everyone is settled up</div>
        ) : (
          <div className="list compact">
            {(showPairwise ? balances.pairwise : balances.suggestedSettlements).map((t, i) => {
              const from = userById(t.from);
              const to = userById(t.to);
              const involvesMe = t.from === viewerId || t.to === viewerId;
              return (
                <div key={i} className={`list-row ${involvesMe ? 'highlight' : ''}`}>
                  <Avatar user={from} size="sm" />
                  <span className="list-main small">
                    <strong>{from?.name}</strong> {t.from === viewerId ? '(you) ' : ''}
                    <span className="muted">pays</span> <strong>{to?.name}</strong> {t.to === viewerId ? '(you)' : ''}
                  </span>
                  <span className="money">{money(t.amount, group.currency)}</span>
                  <Button size="sm" variant="secondary" onClick={() => onSettle(t)}>
                    Record
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

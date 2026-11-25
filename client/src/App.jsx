import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Avatar, Button, Field, Modal, Toasts } from './components/ui.jsx';
import { useApp } from './lib/store.jsx';
import GroupPage from './pages/GroupPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import PeoplePage from './pages/PeoplePage.jsx';

export default function App() {
  const { toasts, authRequired } = useApp();
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer muted">
        ExpenseSplit v2 · <a href="/api/docs" target="_blank" rel="noreferrer">API docs</a> ·{' '}
        <a href="/api/health" target="_blank" rel="noreferrer">health</a>
      </footer>
      <Toasts toasts={toasts} />
      {authRequired && <ApiKeyModal />}
    </div>
  );
}

function Header() {
  const { users, viewer, viewerId, setViewerId } = useApp();
  return (
    <header className="header">
      <div className="container header-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">≈</span> <span className="brand-text">ExpenseSplit</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Groups
          </NavLink>
          <NavLink to="/people">People</NavLink>
        </nav>
        <div className="viewer">
          {viewer && <Avatar user={viewer} size="sm" />}
          <label className="viewer-select">
            <span className="muted">Viewing as</span>
            <select value={viewerId} onChange={(e) => setViewerId(e.target.value)} disabled={!users.length}>
              {!users.length && <option value="">No people yet</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function ApiKeyModal() {
  const { submitApiKey } = useApp();
  const [key, setKey] = useState('');
  return (
    <Modal
      title="API key required"
      subtitle="This server is protected. Enter the API_KEY it was started with."
      onClose={() => {}}
      footer={
        <Button onClick={() => submitApiKey(key.trim())} disabled={!key.trim()}>
          Continue
        </Button>
      }
    >
      <Field label="API key">
        <input type="password" autoFocus value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && key.trim() && submitApiKey(key.trim())} />
      </Field>
    </Modal>
  );
}

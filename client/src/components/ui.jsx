import { useEffect } from 'react';
import { colorFor, initials, money as formatMoney } from '../lib/format.js';

export function Button({ variant = 'primary', size, className = '', loading, children, ...rest }) {
  return (
    <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spinner spinner-sm" /> : children}
    </button>
  );
}

export function Avatar({ user, size = 'md' }) {
  const name = user?.name ?? '?';
  return (
    <span className={`avatar avatar-${size}`} style={{ background: colorFor(user?.id) }} title={name} aria-label={name}>
      {initials(name) || '?'}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size="sm" />
      ))}
      {extra > 0 && <span className="avatar avatar-sm avatar-extra">+{extra}</span>}
    </span>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function EmptyState({ icon = '✨', title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="loading">
      <span className="spinner" /> <span className="muted">{label}</span>
    </div>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Money({ amount, currency, signed, className = '' }) {
  const cls = amount > 0 ? 'pos' : amount < 0 ? 'neg' : 'zero';
  return <span className={`money ${signed ? cls : ''} ${className}`}>{formatMoney(amount, currency, { sign: signed })}</span>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ title, body, confirmLabel = 'Delete', onConfirm, onClose, danger = true, loading }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Modal>
  );
}

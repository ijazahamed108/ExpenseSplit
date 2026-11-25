const formatters = new Map();

export function money(amount, currency = 'USD', { sign = false } = {}) {
  const key = `${currency}|${sign}`;
  if (!formatters.has(key)) {
    try {
      formatters.set(
        key,
        new Intl.NumberFormat(undefined, { style: 'currency', currency, signDisplay: sign ? 'exceptZero' : 'auto' }),
      );
    } catch {
      formatters.set(key, { format: (n) => `${currency} ${n.toFixed(2)}` });
    }
  }
  return formatters.get(key).format(amount ?? 0);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return shortDate(iso);
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

const PALETTE = ['#0f766e', '#7c3aed', '#db2777', '#ea580c', '#2563eb', '#ca8a04', '#059669', '#dc2626', '#4f46e5', '#0891b2'];
export function colorFor(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const CATEGORIES = [
  ['general', '🧾', 'General'],
  ['food', '🍽️', 'Food & drink'],
  ['groceries', '🛒', 'Groceries'],
  ['rent', '🏠', 'Rent'],
  ['utilities', '💡', 'Utilities'],
  ['transport', '🚕', 'Transport'],
  ['accommodation', '🛏️', 'Accommodation'],
  ['entertainment', '🎟️', 'Entertainment'],
  ['shopping', '🛍️', 'Shopping'],
  ['health', '💊', 'Health'],
  ['travel', '✈️', 'Travel'],
  ['other', '📦', 'Other'],
];
export const categoryIcon = (c) => CATEGORIES.find(([k]) => k === c)?.[1] ?? (c === 'settlement' ? '🤝' : '🧾');

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'CHF'];

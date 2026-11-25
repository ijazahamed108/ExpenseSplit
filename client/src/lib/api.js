const BASE = '/api/v1';
const KEY_STORAGE = 'expensesplit.apiKey';

export const getApiKey = () => localStorage.getItem(KEY_STORAGE) || '';
export const setApiKey = (key) => (key ? localStorage.setItem(KEY_STORAGE, key) : localStorage.removeItem(KEY_STORAGE));

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const key = getApiKey();
  if (key) headers['x-api-key'] = key;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  health: () => fetch('/api/health').then((r) => r.json()),

  users: {
    list: () => request('GET', '/users'),
    create: (data) => request('POST', '/users', data),
    update: (id, data) => request('PATCH', `/users/${id}`, data),
    remove: (id) => request('DELETE', `/users/${id}`),
    balances: (id) => request('GET', `/users/${id}/balances`),
  },
  groups: {
    list: (params) => request('GET', `/groups${q(params)}`),
    get: (id) => request('GET', `/groups/${id}`),
    create: (data) => request('POST', '/groups', data),
    update: (id, data) => request('PATCH', `/groups/${id}`, data),
    remove: (id) => request('DELETE', `/groups/${id}`),
    addMember: (id, userId) => request('POST', `/groups/${id}/members`, { userId }),
    removeMember: (id, userId) => request('DELETE', `/groups/${id}/members/${userId}`),
    balances: (id) => request('GET', `/groups/${id}/balances`),
    activity: (id, params) => request('GET', `/groups/${id}/activity${q(params)}`),
  },
  expenses: {
    list: (groupId, params) => request('GET', `/groups/${groupId}/expenses${q(params)}`),
    create: (groupId, data) => request('POST', `/groups/${groupId}/expenses`, data),
    update: (id, data) => request('PATCH', `/expenses/${id}`, data),
    remove: (id) => request('DELETE', `/expenses/${id}`),
  },
  settlements: {
    list: (groupId) => request('GET', `/groups/${groupId}/settlements`),
    create: (groupId, data) => request('POST', `/groups/${groupId}/settlements`, data),
    remove: (id) => request('DELETE', `/settlements/${id}`),
  },
  demo: { seed: (force) => request('POST', `/demo/seed${q({ force: force ? 'true' : undefined })}`) },
};

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, setApiKey } from './api.js';

const AppContext = createContext(null);
const VIEWER_KEY = 'expensesplit.viewerId';

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [viewerId, setViewerIdState] = useState(() => localStorage.getItem(VIEWER_KEY) || '');
  const [toasts, setToasts] = useState([]);
  const [authRequired, setAuthRequired] = useState(false);
  const toastId = useRef(0);

  const toast = useCallback((message, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  /** Run an API call with unified error handling; returns undefined on failure. */
  const run = useCallback(
    async (fn, { success } = {}) => {
      try {
        const result = await fn();
        if (success) toast(success, 'success');
        return result;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthRequired(true);
        } else {
          const detail = err.details?.[0]?.message ? `: ${err.details[0].message}` : '';
          toast(`${err.message}${detail}`, 'error');
        }
        return undefined;
      }
    },
    [toast],
  );

  const refreshUsers = useCallback(async () => {
    const list = await run(() => api.users.list());
    if (list) {
      setUsers(list);
      setUsersLoaded(true);
    }
    return list;
  }, [run]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Keep the viewer valid: fall back to the first user when the stored one disappears.
  useEffect(() => {
    if (!usersLoaded) return;
    if (users.length && !users.some((u) => u.id === viewerId)) setViewerIdState(users[0].id);
    if (!users.length && viewerId) setViewerIdState('');
  }, [users, usersLoaded, viewerId]);

  const setViewerId = useCallback((id) => {
    setViewerIdState(id);
    if (id) localStorage.setItem(VIEWER_KEY, id);
    else localStorage.removeItem(VIEWER_KEY);
  }, []);

  const submitApiKey = useCallback(
    async (key) => {
      setApiKey(key);
      setAuthRequired(false);
      await refreshUsers();
    },
    [refreshUsers],
  );

  const value = useMemo(
    () => ({
      users,
      usersLoaded,
      userById: (id) => users.find((u) => u.id === id),
      refreshUsers,
      viewerId,
      viewer: users.find((u) => u.id === viewerId),
      setViewerId,
      toast,
      toasts,
      run,
      authRequired,
      submitApiKey,
    }),
    [users, usersLoaded, refreshUsers, viewerId, setViewerId, toast, toasts, run, authRequired, submitApiKey],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const MessengerContext = createContext(null);
export const useMessenger = () => useContext(MessengerContext);
const empty = owner => ({ owner, open: false, hasOpened: false, target: null });

export function MessengerProvider({ children }) {
  const { user } = useAuth();
  const owner = user?._id || user?.id || null;
  const [stored, setStored] = useState(() => empty(owner));
  const current = stored.owner === owner ? stored : empty(owner);
  const openMessenger = useCallback(target => setStored(previous => {
    const base = previous.owner === owner ? previous : empty(owner);
    return { ...base, open: true, hasOpened: true,
      target: target ? { ...target, requestId: (base.target?.requestId || 0) + 1 } : base.target };
  }), [owner]);
  const toggle = useCallback(() => setStored(previous => {
    const base = previous.owner === owner ? previous : empty(owner);
    return { ...base, open: !base.open, hasOpened: true };
  }), [owner]);
  const close = useCallback(() => setStored(previous => ({ ...(previous.owner === owner ? previous : empty(owner)), open: false })), [owner]);
  const value = useMemo(() => ({ ...current, openMessenger, toggle, close }), [current, openMessenger, toggle, close]);
  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscribeMessaging } from '../services/messaging-events';
import VideoCallController, { emptyVideoCallState } from '../services/video-call-controller';
import VideoCallWindow from '../Component/VideoCall/VideoCallWindow';

const Context = createContext(null);
export const useVideoCall = () => useContext(Context);

function VideoCallSession({ user, children }) {
  const [state, setState] = useState(emptyVideoCallState);
  const controllerRef = useRef(null);
  const userId = user?._id || user?.id;
  const enabled = Boolean(userId && ['farmer', 'enterprise'].includes(user?.role));
  useEffect(() => {
    if (!enabled) return undefined;
    const sessionId = window.crypto?.randomUUID?.() || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const controller = new VideoCallController({ userId, sessionId, onChange: setState });
    controllerRef.current = controller;
    const unsubscribe = subscribeMessaging(event => {
      if (event.type === 'call' || event.type === 'connected') void controller.sync();
    });
    void controller.sync();
    const timer = setInterval(() => { void controller.poll(); }, 2000);
    const pagehide = () => controller.releaseOnUnload();
    window.addEventListener('pagehide', pagehide);
    return () => {
      unsubscribe(); clearInterval(timer); window.removeEventListener('pagehide', pagehide);
      controller.dispose(); controllerRef.current = null;
    };
  }, [enabled, userId]);
  const actions = useMemo(() => ({
    start: (conversationId, name) => controllerRef.current?.start(conversationId, name),
    accept: () => controllerRef.current?.accept(),
    decline: () => controllerRef.current?.end('declined'),
    end: () => controllerRef.current?.end(),
    toggleMic: () => controllerRef.current?.toggleMic(),
    toggleCamera: () => controllerRef.current?.toggleCamera(),
    dismiss: () => controllerRef.current?.dismiss(),
  }), []);
  const value = useMemo(() => ({ ...actions, enabled, busy: Boolean(state.call || state.phase === 'preparing') }), [actions, enabled, state.call, state.phase]);
  return <Context.Provider value={value}>{children}<VideoCallWindow state={state} actions={actions} /></Context.Provider>;
}

export function VideoCallProvider({ children }) {
  const { user } = useAuth();
  return <VideoCallSession key={user?._id || user?.id || 'guest'} user={user}>{children}</VideoCallSession>;
}

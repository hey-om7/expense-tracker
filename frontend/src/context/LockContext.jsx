import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * PIN lock state, shared by the PIN screen and the app shell.
 * The shell does not mount any page (and so renders no financial data) until the
 * PIN has been verified in this tab. Data may load in memory meanwhile.
 */
const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // lock after 2 minutes without activity
const LOCK_KEY = 'vestor_is_locked';

const LockContext = createContext(null);

// Unlocked only if the PIN was already entered in this tab (survives reloads, not new tabs).
const initialLocked = () => {
  try { return sessionStorage.getItem(LOCK_KEY) !== 'false'; } catch { return true; }
};

export const LockProvider = ({ children }) => {
  const [isLocked, setIsLocked] = useState(initialLocked);
  const timerRef = useRef(null);

  const lock = useCallback(() => {
    setIsLocked(true);
    try { sessionStorage.setItem(LOCK_KEY, 'true'); } catch { /* storage blocked */ }
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    try { sessionStorage.setItem(LOCK_KEY, 'false'); } catch { /* storage blocked */ }
  }, []);

  // Idle timer: any activity pushes the lock back.
  useEffect(() => {
    if (isLocked) return undefined;
    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lock, INACTIVITY_TIMEOUT);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    reset();
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isLocked, lock]);

  return (
    <LockContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </LockContext.Provider>
  );
};

export const useLock = () => useContext(LockContext);

import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { useLock } from '../../context/LockContext';
import { preloadPage, preloadAllPages } from '../../pages/appPages';
import DashboardSkeleton from '../ui/skeletons/DashboardSkeleton';
import HistorySkeleton from '../ui/skeletons/HistorySkeleton';

const whenIdle = (fn) => (window.requestIdleCallback
  ? window.requestIdleCallback(fn, { timeout: 3000 })
  : window.setTimeout(fn, 1500));

/**
 * Decides when the app (layout and pages) may render.
 *
 * - Nothing that shows financial data mounts until the session is confirmed by the
 *   server AND the PIN has been entered in this tab. Data and the current page's
 *   code load in the background meanwhile, so the page appears as soon as the PIN
 *   is accepted.
 * - Once shown, the app stays mounted. Re-locking (idle timeout) hides it and makes
 *   it non-interactive instead of unmounting, so unlocking again is instant and
 *   page state (scroll, filters, open forms) is kept.
 */
const AppShell = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { ready } = useAppContext();
  const { isLocked } = useLock();
  const { pathname } = useLocation();
  const wrapperRef = useRef(null);

  const allowed = isAuthenticated && !isLocked;
  const [shown, setShown] = useState(false);
  const show = shown || (allowed && ready);

  // While the PIN is being entered, fetch the code for the page being opened.
  useEffect(() => { preloadPage(pathname); }, [pathname]);

  useEffect(() => {
    if (!show || shown) return;
    setShown(true);
    // After the first reveal: fetch the other pages' code so navigation never waits,
    // and ask for OS notification permission (no longer prompts over the PIN screen).
    whenIdle(preloadAllPages);
    if ('Notification' in window && Notification.permission === 'default') {
      Promise.resolve(Notification.requestPermission()).catch(() => {});
    }
  }, [show, shown]);

  // React 18 has no `inert` prop; set the attribute directly.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (isLocked) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [isLocked, show]);

  if (!show) {
    // PIN accepted but data still arriving: show the page skeleton. While locked,
    // render nothing behind the PIN screen.
    if (!allowed) return null;
    return pathname === '/transactions' ? <HistorySkeleton /> : <DashboardSkeleton />;
  }

  return (
    <div ref={wrapperRef} aria-hidden={isLocked || undefined} className={isLocked ? 'invisible' : undefined}>
      {children}
    </div>
  );
};

export default AppShell;

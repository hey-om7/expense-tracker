import React, { useEffect } from 'react';
import { syncNewGmailEmails } from '../../services/api';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardSkeleton from '../ui/skeletons/DashboardSkeleton';
import HistorySkeleton from '../ui/skeletons/HistorySkeleton';

// optimistic: render children while the session check runs (only for routes whose
// children gate their own content, i.e. the PIN-locked app shell).
const ProtectedRoute = ({ children, optimistic = false }) => {
  const { isAuthenticated, likelyAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Once per page load after sign-in, check Gmail for new payment emails in the
  // background so expense suggestions are fresh. Errors are ignored on purpose.
  useEffect(() => {
    if (!isAuthenticated || window.__vestorGmailSynced) return;
    window.__vestorGmailSynced = true;
    syncNewGmailEmails().catch(() => {});
  }, [isAuthenticated]);

  // Returning users go straight to the PIN screen while /auth/me runs. Pages stay
  // unmounted until the session is confirmed and the PIN entered (see AppShell).
  if (loading && !(optimistic && likelyAuthenticated)) {
    if (window.location.pathname === '/voice') {
      return <div className="min-h-[100dvh] bg-[#1a120b]" aria-busy="true" />;
    }
    if (window.location.pathname === '/transactions') {
      return <HistorySkeleton />;
    }
    return <DashboardSkeleton />;
  }

  if (!loading && !isAuthenticated) {
    // Remember where the user was going (e.g. the /voice shortcut) so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
};

export default ProtectedRoute;

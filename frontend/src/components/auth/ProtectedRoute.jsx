import React, { useEffect } from 'react';
import { syncNewGmailEmails } from '../../services/api';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardSkeleton from '../ui/skeletons/DashboardSkeleton';
import HistorySkeleton from '../ui/skeletons/HistorySkeleton';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Once per page load after sign-in, check Gmail for new payment emails in the
  // background so expense suggestions are fresh. Errors are ignored on purpose.
  useEffect(() => {
    if (!isAuthenticated || window.__walloGmailSynced) return;
    window.__walloGmailSynced = true;
    syncNewGmailEmails().catch(() => {});
  }, [isAuthenticated]);

  if (loading) {
    if (window.location.pathname === '/voice') {
      return <div className="min-h-[100dvh] bg-[#1a120b]" aria-busy="true" />;
    }
    if (window.location.pathname === '/transactions') {
      return <HistorySkeleton />;
    }
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    // Remember where the user was going (e.g. the /voice shortcut) so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
};

export default ProtectedRoute;

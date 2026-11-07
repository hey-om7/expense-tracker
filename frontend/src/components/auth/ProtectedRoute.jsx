import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardSkeleton from '../ui/skeletons/DashboardSkeleton';
import HistorySkeleton from '../ui/skeletons/HistorySkeleton';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

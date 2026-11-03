import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardSkeleton from '../ui/skeletons/DashboardSkeleton';
import HistorySkeleton from '../ui/skeletons/HistorySkeleton';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    if (window.location.pathname === '/transactions') {
      return <HistorySkeleton />;
    }
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

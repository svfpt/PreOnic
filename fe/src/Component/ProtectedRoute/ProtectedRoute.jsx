import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants';

/**
 * ProtectedRoute - Protect routes that require authentication
 * Usage: <ProtectedRoute><YourComponent /></ProtectedRoute>
 * Usage with roles: <ProtectedRoute allowedRoles={['farmer']}><YourComponent /></ProtectedRoute>
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isLoggedIn, loading } = useAuth();

  // Wait for auth state to initialize before redirecting
  if (loading) return null;

  if (!isLoggedIn) {
    return <Navigate to={ROUTES.AUTH} replace />;
  }

  if (allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'admin') {
        return <Navigate to={ROUTES.ADMIN} replace />;
      } else if (user.role === 'farmer') {
        return <Navigate to={ROUTES.FARMER} replace />;
      } else if (user.role === 'enterprise') {
        return <Navigate to={ROUTES.ENTERPRISE} replace />;
      } else {
        return <Navigate to={ROUTES.HOME} replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;

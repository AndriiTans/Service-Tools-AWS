import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedLayout from './ProtectedLayout';
import {
  Dashboard,
  Home,
  Login,
  NotFound,
  ParserLayout,
  ParserResultDetails,
  ParserResults,
  Register,
  Upload,
  UserMessagesList,
} from './pages';
import NonAuthLayout from './NonAuthLayout';
import { AuthProvider } from './contexts/AuthContext';
import useAuth from './hooks/useAuth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/auth/login" replace />;
};

const AppContent = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={!isAuthenticated ? <NonAuthLayout /> : <Navigate to="/dashboard" replace />}
      >
        <Route index element={<Home />} />
        <Route path="auth">
          <Route
            path="login"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="register"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
          />
        </Route>
      </Route>

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="parser" element={<ParserLayout />}>
          <Route index element={<Navigate to="upload" replace />} />
          <Route path="upload" element={<Upload />} />
          <Route path="results" element={<ParserResults />} />
          <Route path="user-messages" element={<UserMessagesList />} />
          <Route path="results/file/:id" element={<ParserResultDetails />} />
        </Route>
      </Route>

      {/* 404 Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <AuthProvider>
    <Router>
      <AppContent />
    </Router>
  </AuthProvider>
);

export default App;

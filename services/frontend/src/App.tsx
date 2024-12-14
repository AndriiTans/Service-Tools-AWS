import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import ProtectedLayout from './ProtectedLayout';
import {
  Dashboard,
  Home,
  Login,
  NotFound,
  Parser,
  ParserResultDetails,
  ParserResults,
  Register,
  Upload,
} from './pages';
import NonAuthLayout from './NonAuthLayout';
import { useAuth, AuthProvider } from './contexts/AuthContext';

const AppContent = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>; // Replace with a custom loading component if needed
  }

  return (
    <Routes>
      <Route element={isAuthenticated ? <Layout /> : <NonAuthLayout />}>
        <Route path="/" element={<Home />} />

        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route
          path="dashboard"
          element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="" element={<Dashboard />} />
          <Route path="parser" element={<Parser />}>
            <Route path="upload" element={<Upload />} />
            <Route path="results" element={<ParserResults />}>
              <Route path=":id" element={<ParserResultDetails />} />
            </Route>

            <Route index element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>

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

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LockScreen from './components/auth/LockScreen';
import Layout from './components/layout/Layout';
import DashboardScreen from './pages/Dashboard';
import TransactionsScreen from './pages/Transactions';
import InvestmentsScreen from './pages/Investments';
import AnalyticsScreen from './pages/Analytics';
import CategoriesScreen from './pages/Categories';
import CyclicScreen from './pages/Cyclic';
import SettingsScreen from './pages/Settings';
import LoginScreen from './pages/Login';
import RegisterScreen from './pages/Register';
import ToastContainer from './components/ui/ToastContainer';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppProvider>
                  <LockScreen />
                  <Layout>
                    <Routes>
                      <Route path="/" element={<DashboardScreen />} />
                      <Route path="/transactions" element={<TransactionsScreen />} />
                      <Route path="/investments" element={<InvestmentsScreen />} />
                      <Route path="/cyclic" element={<CyclicScreen />} />
                      <Route path="/analytics" element={<AnalyticsScreen />} />
                      <Route path="/categories" element={<CategoriesScreen />} />
                      <Route path="/settings" element={<SettingsScreen />} />
                    </Routes>
                    <ToastContainer />
                  </Layout>
                </AppProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

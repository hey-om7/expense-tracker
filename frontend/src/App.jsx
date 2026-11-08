import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { OnboardingProvider } from './context/OnboardingContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LockScreen from './components/auth/LockScreen';
import Layout from './components/layout/Layout';
import LoginScreen from './pages/Login';
import RegisterScreen from './pages/Register';
import ForgotPasswordScreen from './pages/ForgotPassword';
import ResetPasswordScreen from './pages/ResetPassword';
import VerifyEmailScreen from './pages/VerifyEmail';
import VoiceAddScreen from './pages/VoiceAdd';
import ToastContainer from './components/ui/ToastContainer';
import DashboardSkeleton from './components/ui/skeletons/DashboardSkeleton';

// App pages load on demand so /voice doesn't download dashboard/chart code.
const DashboardScreen = lazy(() => import('./pages/Dashboard'));
const TransactionsScreen = lazy(() => import('./pages/Transactions'));
const InvestmentsScreen = lazy(() => import('./pages/Investments'));
const AnalyticsScreen = lazy(() => import('./pages/Analytics'));
const CategoriesScreen = lazy(() => import('./pages/Categories'));
const CyclicScreen = lazy(() => import('./pages/Cyclic'));
const SettingsScreen = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password/:token" element={<ResetPasswordScreen />} />
          <Route path="/verify-email/:token" element={<VerifyEmailScreen />} />

          {/* Voice quick-add shortcut: full screen, no sidebar/nav, login required but no PIN lock */}
          <Route
            path="/voice"
            element={
              <ProtectedRoute>
                <AppProvider lite>
                  <VoiceAddScreen />
                  <ToastContainer />
                </AppProvider>
              </ProtectedRoute>
            }
          />

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppProvider>
                  <OnboardingProvider>
                    <LockScreen />
                    <Layout>
                      <Suspense fallback={<DashboardSkeleton />}>
                      <Routes>
                        <Route path="/" element={<DashboardScreen />} />
                        <Route path="/transactions" element={<TransactionsScreen />} />
                        <Route path="/investments" element={<InvestmentsScreen />} />
                        <Route path="/cyclic" element={<CyclicScreen />} />
                        <Route path="/analytics" element={<AnalyticsScreen />} />
                        <Route path="/categories" element={<CategoriesScreen />} />
                        <Route path="/settings" element={<SettingsScreen />} />
                      </Routes>
                      </Suspense>
                      <ToastContainer />
                    </Layout>
                  </OnboardingProvider>
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

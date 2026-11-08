import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { OnboardingProvider } from './context/OnboardingContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LockScreen from './components/auth/LockScreen';
import AppShell from './components/auth/AppShell';
import { LockProvider } from './context/LockContext';
import { pages } from './pages/appPages';
import Layout from './components/layout/Layout';
import LoginScreen from './pages/Login';
import RegisterScreen from './pages/Register';
import ForgotPasswordScreen from './pages/ForgotPassword';
import ResetPasswordScreen from './pages/ResetPassword';
import VerifyEmailScreen from './pages/VerifyEmail';
import VoiceAddScreen from './pages/VoiceAdd';
import ToastContainer from './components/ui/ToastContainer';
import DashboardSkeleton from './components/ui/skeletons/DashboardSkeleton';

const {
  '/': DashboardScreen, '/transactions': TransactionsScreen, '/investments': InvestmentsScreen,
  '/cyclic': CyclicScreen, '/analytics': AnalyticsScreen, '/categories': CategoriesScreen, '/settings': SettingsScreen,
} = pages;

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
              <ProtectedRoute optimistic>
                <AppProvider>
                  <LockProvider>
                    <OnboardingProvider>
                      {/* The PIN screen renders immediately; data loads behind it. */}
                      <LockScreen />
                      <AppShell>
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
                      </AppShell>
                    </OnboardingProvider>
                  </LockProvider>
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

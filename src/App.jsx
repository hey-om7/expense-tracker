import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/layout/Layout';
import DashboardScreen from './pages/Dashboard';
import TransactionsScreen from './pages/Transactions';
import InvestmentsScreen from './pages/Investments';
import AnalyticsScreen from './pages/Analytics';
import CategoriesScreen from './pages/Categories';
import CyclicScreen from './pages/Cyclic';
import ToastContainer from './components/ui/ToastContainer';

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/transactions" element={<TransactionsScreen />} />
            <Route path="/investments" element={<InvestmentsScreen />} />
            <Route path="/cyclic" element={<CyclicScreen />} />
            <Route path="/analytics" element={<AnalyticsScreen />} />
            <Route path="/categories" element={<CategoriesScreen />} />
          </Routes>
          <ToastContainer />
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;

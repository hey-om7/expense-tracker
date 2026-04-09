import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../services/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Normalize Mongo _id → id for frontend consistency ───
  const normalize = (doc) => {
    if (!doc) return doc;
    const { _id, __v, ...rest } = doc;
    return { ...rest, id: _id };
  };
  const normalizeList = (list) => Array.isArray(list) ? list.map(normalize) : [];

  // ─── Initial Data Load ───
  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const [txs, cats, invs, notifs, subs, ccs] = await Promise.all([
          api.fetchTransactions(),
          api.fetchCategories(),
          api.fetchInvestments(),
          api.fetchNotifications(),
          api.fetchSubscriptions(),
          api.fetchCreditCards(),
        ]);
        setTransactions(normalizeList(txs));
        setCategories(normalizeList(cats));
        setInvestments(normalizeList(invs));
        setNotifications(normalizeList(notifs));
        setSubscriptions(normalizeList(subs));
        setCreditCards(normalizeList(ccs));
        setError(null);

        // Request OS Notification Permissions natively
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // Run automated subscription check on app load
        try {
          const result = await api.runSubscriptionCheck();
          if (result.processed > 0) {
            // Re-fetch affected data after automation
            const [updatedTxs, updatedSubs, updatedNotifs] = await Promise.all([
              api.fetchTransactions(),
              api.fetchSubscriptions(),
              api.fetchNotifications(),
            ]);
            setTransactions(normalizeList(updatedTxs));
            setSubscriptions(normalizeList(updatedSubs));
            setNotifications(normalizeList(updatedNotifs));
          }
        } catch (subErr) {
          console.warn('Subscription check failed:', subErr.message);
        }
      } catch (err) {
        console.error('Failed to load app data:', err);
        setError('Failed to connect to server. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // ─── Aggregate Data ───
  const totalBalance = transactions.reduce((acc, curr) => {
    if (curr.type === 'income') return acc + curr.amount;
    if (curr.type === 'expense') return acc - curr.amount;
    if (curr.type === 'buy_investment') return acc - curr.amount;
    if (curr.type === 'sell_investment') return acc + curr.amount;
    return acc;
  }, 0);

  const monthlySpent = transactions
    .filter(t => (t.type === 'expense') && new Date(t.date).getMonth() === new Date().getMonth() && new Date(t.date).getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + curr.amount, 0);

  // ─── Live Investments ───
  // Since the backend now computes totalQuantity and avgBuyPrice from holdings,
  // we just use the investments array directly.
  const derivedInvestments = useMemo(() => {
    return investments.map(inv => {
      const shares = inv.totalQuantity || 0;
      const avgCost = inv.avgBuyPrice || 0;
      const unrealizedProfit = (inv.currentPrice - avgCost) * shares;

      return {
        ...inv,
        shares,
        avgCost,
        unrealizedProfit,
        // In backend we compute realizedProfit.
        realizedProfit: inv.realizedProfit || 0,
        // Frontend uses trades property in the history tab, map from holdings
        trades: [...(inv.holdings || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).map(h => ({
          ...h,
          id: h._id,
          shares: h.quantity, // map quantity -> shares for the UI
        })),
      };
    });
  }, [investments]);

  const totalPortfolioValue = derivedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);
  const totalInvested = derivedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0);
  const totalRealizedProfit = derivedInvestments.reduce((acc, curr) => acc + (curr.realizedProfit || 0), 0);
  const totalUnrealizedProfit = derivedInvestments.reduce((acc, curr) => acc + (curr.unrealizedProfit || 0), 0);

  // ─── Notification Actions ───
  const getCategory = (id) => categories.find(c => c.id === id);

  const addNotification = useCallback(async (n) => {
    try {
      const saved = await api.createNotification({ ...n, date: new Date().toISOString(), isRead: false });
      setNotifications(prev => [normalize(saved), ...prev]);

      // OS Notification Trigger
      if ('Notification' in window && Notification.permission === 'granted') {
         new Notification(n.title, { body: n.message, icon: '/favicon.svg' });
      }
    } catch (err) {
      console.error('Failed to add notification:', err);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, []);

  // ─── Transaction Actions ───
  const addTransaction = useCallback(async (t) => {
    try {
      const saved = await api.createTransaction({ ...t, date: t.date || new Date().toISOString() });
      setTransactions(prev => [normalize(saved), ...prev]);
      return normalize(saved);
    } catch (err) {
      console.error('Failed to add transaction:', err);
    }
  }, []);

  const updateTransaction = useCallback(async (id, updatedT) => {
    try {
      const saved = await api.updateTransaction(id, updatedT);
      setTransactions(prev => prev.map(t => t.id === id ? normalize(saved) : t));
    } catch (err) {
      console.error('Failed to update transaction:', err);
    }
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    try {
      await api.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  }, []);

  // ─── Category Actions ───
  const addCategory = useCallback(async (c) => {
    try {
      const saved = await api.createCategory(c);
      setCategories(prev => [...prev, normalize(saved)]);
    } catch (err) {
      console.error('Failed to add category:', err);
    }
  }, []);

  const updateCategory = useCallback(async (id, updatedC) => {
    try {
      const saved = await api.updateCategory(id, updatedC);
      setCategories(prev => prev.map(c => c.id === id ? normalize(saved) : c));
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  }, []);

  const deleteCategory = useCallback(async (id) => {
    try {
      await api.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }, []);

  // ─── Investment Actions ───
  const addInvestment = useCallback(async (i) => {
    try {
      const saved = await api.createInvestment(i);
      setInvestments(prev => [...prev, normalize(saved)]);
    } catch (err) {
      console.error('Failed to add investment:', err);
    }
  }, []);

  const updateInvestment = useCallback(async (id, updatedI) => {
    try {
      const saved = await api.updateInvestment(id, updatedI);
      setInvestments(prev => prev.map(i => i.id === id ? normalize(saved) : i));
    } catch (err) {
      console.error('Failed to update investment:', err);
    }
  }, []);

  const deleteInvestment = useCallback(async (id) => {
    try {
      await api.deleteInvestment(id);
      setInvestments(prev => prev.filter(i => i.id !== id));
      // Transactions are independent now, but filter them out in UI just in case
      setTransactions(prev => prev.filter(t => t.investmentId !== id));
    } catch (err) {
      console.error('Failed to delete investment:', err);
    }
  }, []);

  const executeTradeOnInvestment = useCallback(async (investmentId, tradeData) => {
    try {
      const updatedInv = await api.executeInvestmentTrade(investmentId, {
        type: tradeData.type,
        quantity: parseFloat(tradeData.shares), // tradeData uses "shares" in UI
        price: parseFloat(tradeData.price),
        date: tradeData.date
      });
      // Replace the investment with the newly saved/computed one from the backend
      // But wait! The router we wrote returns the raw saved doc. We need to refetch it 
      // or compute locally. It's safer to refetch investments.
      const freshInvestments = await api.fetchInvestments();
      setInvestments(normalizeList(freshInvestments));
      
      // Also refetch transactions because we just created a parallel tx
      const txs = await api.fetchTransactions();
      setTransactions(normalizeList(txs));

      await addNotification({ title: 'Trade Executed', message: `Successfully ${tradeData.type === 'BUY' ? 'bought' : 'sold'} units` });
    } catch (err) {
      console.error('Failed to execute trade:', err);
      // Wait, we need to handle "Cannot sell more than held", maybe throw error back
      throw err;
    }
  }, [addNotification]);

  const deleteHolding = useCallback(async (investmentId, holdingId) => {
    try {
      await api.deleteInvestmentHolding(investmentId, holdingId);
      // Refetch data
      const [freshInvestments, txs] = await Promise.all([
        api.fetchInvestments(),
        api.fetchTransactions()
      ]);
      setInvestments(normalizeList(freshInvestments));
      setTransactions(normalizeList(txs));
      await addNotification({ title: 'Trade Reversed', message: `Historical trade deleted.` });
    } catch (err) {
      console.error('Failed to delete holding:', err);
    }
  }, [addNotification]);

  // ─── Subscription Actions ───
  const addSubscription = useCallback(async (s) => {
    try {
      const saved = await api.createSubscription(s);
      setSubscriptions(prev => [normalize(saved), ...prev]);
      return normalize(saved);
    } catch (err) {
      console.error('Failed to add subscription:', err);
    }
  }, []);

  const updateSubscription = useCallback(async (id, updatedS) => {
    try {
      const saved = await api.updateSubscription(id, updatedS);
      setSubscriptions(prev => prev.map(s => s.id === id ? normalize(saved) : s));
    } catch (err) {
      console.error('Failed to update subscription:', err);
    }
  }, []);

  const deleteSubscription = useCallback(async (id) => {
    try {
      await api.deleteSubscription(id);
      setSubscriptions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete subscription:', err);
    }
  }, []);

  // ─── Credit Card Actions ───
  const addCreditCard = useCallback(async (c) => {
    try {
      const saved = await api.createCreditCard(c);
      setCreditCards(prev => [normalize(saved), ...prev]);
    } catch (err) {
      console.error('Failed to add credit card:', err);
    }
  }, []);

  const updateCreditCard = useCallback(async (id, updatedC) => {
    try {
      const saved = await api.updateCreditCard(id, updatedC);
      setCreditCards(prev => prev.map(c => c.id === id ? normalize(saved) : c));
    } catch (err) {
      console.error('Failed to update credit card:', err);
    }
  }, []);

  const deleteCreditCard = useCallback(async (id) => {
    try {
      await api.deleteCreditCard(id);
      setCreditCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete credit card:', err);
    }
  }, []);



  // ─── Loading / Error States ───
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-manrope font-bold text-sm uppercase tracking-widest">Connecting to Wallo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-surface-container-low border border-error/20 rounded-2xl p-8 max-w-md text-center">
          <span className="material-symbols-outlined text-5xl text-error mb-4">cloud_off</span>
          <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Connection Failed</h2>
          <p className="text-on-surface-variant text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-primary-container text-on-primary py-3 px-6 rounded-xl font-bold hover:brightness-110 transition-all">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      transactions, categories, investments: derivedInvestments, notifications, subscriptions, creditCards, loading,
      totalBalance, monthlySpent, totalPortfolioValue, totalInvested, totalRealizedProfit, totalUnrealizedProfit,
      addTransaction, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory, getCategory,
      addInvestment, updateInvestment, deleteInvestment, executeTradeOnInvestment, deleteHolding,
      addSubscription, updateSubscription, deleteSubscription,
      addCreditCard, updateCreditCard, deleteCreditCard,
      addNotification, markAsRead, markAllAsRead, clearNotifications
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);

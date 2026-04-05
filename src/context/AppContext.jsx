import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getFromStorage, saveToStorage, initialCategories, initialTransactions, initialInvestments, initialNotifications } from '../services/dataService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [transactions, setTransactions] = useState(() => getFromStorage('transactions', initialTransactions));
  const [categories, setCategories] = useState(() => getFromStorage('categories', initialCategories));
  const [investments, setInvestments] = useState(() => getFromStorage('investments', initialInvestments));
  const [notifications, setNotifications] = useState(() => getFromStorage('notifications', initialNotifications));

  useEffect(() => {
    saveToStorage('transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    saveToStorage('categories', categories);
  }, [categories]);

  useEffect(() => {
    saveToStorage('investments', investments);
  }, [investments]);

  useEffect(() => {
    saveToStorage('notifications', notifications);
  }, [notifications]);

  // Aggregate Data
  const totalBalance = transactions.reduce((acc, curr) => {
    if (curr.type === 'income') return acc + curr.amount;
    if (curr.type === 'expense') return acc - curr.amount;
    if (curr.type === 'buy_investment') return acc - curr.amount;
    if (curr.type === 'sell_investment') return acc + curr.amount;
    return acc;
  }, 0); // No hardcoded offset! Starts at 0 natively.

  const monthlySpent = transactions
    .filter(t => (t.type === 'expense') && new Date(t.date).getMonth() === new Date().getMonth() && new Date(t.date).getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Compute Live Investments
  const derivedInvestments = useMemo(() => {
    return investments.map(inv => {
      // Find all trades for this investment
      const trades = transactions.filter(t => t.investmentId === inv.id && (t.type === 'buy_investment' || t.type === 'sell_investment'));
      
      let totalShares = 0;
      let totalCostBase = 0;
      let realizedProfit = 0;

      // Ensure chronological calculation
      const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

      sortedTrades.forEach(trade => {
         const tradeShares = parseFloat(trade.shares || 0);
         const tradePrice = parseFloat(trade.price || 0);

         if (trade.type === 'buy_investment') {
            const tempCost = totalShares * (totalShares > 0 ? totalCostBase / totalShares : 0);
            const purchaseCost = tradeShares * tradePrice;
            totalShares += tradeShares;
            totalCostBase = totalShares > 0 ? tempCost + purchaseCost : 0;
         } else if (trade.type === 'sell_investment') {
            const currentAvgCost = totalShares > 0 ? totalCostBase / totalShares : 0;
            realizedProfit += (tradePrice - currentAvgCost) * tradeShares;
            totalShares -= tradeShares;
            totalCostBase = totalShares * currentAvgCost; // Scale down base
         }
      });

      const avgCost = totalShares > 0 ? totalCostBase / totalShares : 0;
      const unrealizedProfit = (inv.currentPrice - avgCost) * totalShares;

      return {
        ...inv,
        shares: totalShares,
        avgCost: avgCost,
        realizedProfit: realizedProfit,
        unrealizedProfit: unrealizedProfit,
        trades: sortedTrades
      };
    });
  }, [investments, transactions]);

  const totalPortfolioValue = derivedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);
  const totalInvested = derivedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0);
  const totalRealizedProfit = derivedInvestments.reduce((acc, curr) => acc + (curr.realizedProfit || 0), 0);
  const totalUnrealizedProfit = derivedInvestments.reduce((acc, curr) => acc + (curr.unrealizedProfit || 0), 0);

  // Actions
  const addTransaction = (t) => {
    setTransactions(prev => [{ ...t, id: uuidv4(), date: t.date || new Date().toISOString() }, ...prev]);
  };
  
  const updateTransaction = (id, updatedT) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedT } : t));
  };
  
  const deleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addCategory = (c) => setCategories(prev => [...prev, { ...c, id: uuidv4() }]);
  const updateCategory = (id, updatedC) => setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updatedC } : c));
  const deleteCategory = (id) => setCategories(prev => prev.filter(c => c.id !== id));

  const addInvestment = (i) => setInvestments(prev => [...prev, { ...i, id: uuidv4() }]);
  const updateInvestment = (id, updatedI) => setInvestments(prev => prev.map(i => i.id === id ? { ...i, ...updatedI } : i));
  const deleteInvestment = (id) => {
    setInvestments(prev => prev.filter(i => i.id !== id));
    // Also cleanup orphaned trades
    setTransactions(prev => prev.filter(t => t.investmentId !== id));
  };

  // Advanced Buy/Sell Logic
  const executeTrade = (investmentId, trade, existingTradeId = null) => {
    // trade = { type: 'BUY' | 'SELL', shares, price, date }
    const inv = derivedInvestments.find(i => i.id === investmentId);
    if (!inv) return;

    if (trade.type === 'SELL') {
       // Validate that we aren't selling more than we own! 
       // If editing, we ignore the current trade's previous sell quantity logic temporarily, but let's be safe.
       let availableShares = inv.shares;
       if (existingTradeId) {
          const oldTrade = inv.trades.find(t => t.id === existingTradeId);
          if (oldTrade && oldTrade.type === 'sell_investment') availableShares += oldTrade.shares;
       }

       if (parseFloat(trade.shares) > availableShares) {
          addNotification({ title: 'Trade Failed', message: 'You cannot sell more shares than you hold globally.', isRead: false, date: new Date().toISOString(), id: uuidv4() });
          return;
       }
    }

    const payload = {
      investmentId: investmentId,
      shares: parseFloat(trade.shares),
      price: parseFloat(trade.price),
      amount: parseFloat(trade.shares) * parseFloat(trade.price),
      type: trade.type === 'BUY' ? 'buy_investment' : 'sell_investment',
      date: trade.date || new Date().toISOString(),
      categoryId: 'trade',
      title: `${trade.type === 'BUY' ? 'Bought' : 'Sold'} ${trade.shares} units of ${inv.name}`,
    };

    if (existingTradeId) {
      updateTransaction(existingTradeId, payload);
      addNotification({ title: 'Trade Updated', message: `Updated execution for ${inv.name}`, isRead: false, date: new Date().toISOString(), id: uuidv4() });
    } else {
      addTransaction(payload);
      addNotification({ title: 'Trade Executed', message: `Successfully ${trade.type === 'BUY' ? 'bought' : 'sold'} units of ${inv.name}`, isRead: false, date: new Date().toISOString(), id: uuidv4() });
    }
  };

  const getCategory = (id) => categories.find(c => c.id === id);

  const addNotification = (n) => setNotifications(prev => [{ ...n, id: uuidv4(), date: new Date().toISOString(), isRead: false }, ...prev]);
  const markAsRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  const clearNotifications = () => setNotifications([]);

  return (
    <AppContext.Provider value={{
      transactions, categories, investments: derivedInvestments, notifications,
      totalBalance, monthlySpent, totalPortfolioValue, totalInvested, totalRealizedProfit, totalUnrealizedProfit,
      addTransaction, updateTransaction, deleteTransaction, 
      addCategory, updateCategory, deleteCategory, getCategory,
      addInvestment, updateInvestment, deleteInvestment, executeTrade,
      addNotification, markAsRead, markAllAsRead, clearNotifications
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);

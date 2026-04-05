import React, { createContext, useContext, useState, useEffect } from 'react';
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
  }, 142850.32); // Using initial hardcoded base from UI for this demo

  const monthlySpent = transactions
    .filter(t => (t.type === 'expense' || t.type === 'buy_investment') && new Date(t.date).getMonth() === new Date().getMonth() && new Date(t.date).getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPortfolioValue = investments.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);
  const totalInvested = investments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0);
  const totalRealizedProfit = investments.reduce((acc, curr) => acc + (curr.realizedProfit || 0), 0);
  const totalUnrealizedProfit = totalPortfolioValue - totalInvested;

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

  const addInvestment = (i) => setInvestments(prev => [...prev, { ...i, id: uuidv4(), realizedProfit: 0 }]);
  const updateInvestment = (id, updatedI) => setInvestments(prev => prev.map(i => i.id === id ? { ...i, ...updatedI } : i));
  const deleteInvestment = (id) => setInvestments(prev => prev.filter(i => i.id !== id));

  // Advanced Buy/Sell Logic
  const executeTrade = (investmentId, trade) => {
    // trade = { type: 'BUY' | 'SELL', shares, price, date }
    let success = false;
    let title = '';

    setInvestments(prev => prev.map(inv => {
      if (inv.id !== investmentId) return inv;
      
      const tradeShares = parseFloat(trade.shares);
      const tradePrice = parseFloat(trade.price);
      
      title = `${trade.type === 'BUY' ? 'Bought' : 'Sold'} ${tradeShares} units of ${inv.name}`;

      if (trade.type === 'BUY') {
        const totalCostBefore = inv.shares * inv.avgCost;
        const purchaseCost = tradeShares * tradePrice;
        const newShares = inv.shares + tradeShares;
        const newAvgCost = newShares > 0 ? (totalCostBefore + purchaseCost) / newShares : 0;
        
        success = true;
        return { ...inv, shares: newShares, avgCost: newAvgCost };
      } 
      else if (trade.type === 'SELL') {
        if (tradeShares > inv.shares) {
           addNotification({ title: 'Trade Failed', message: 'Cannot sell more shares than currently owned.', isRead: false, date: new Date().toISOString(), id: uuidv4() });
           return inv; // abort
        }
        
        const newShares = inv.shares - tradeShares;
        const profitFromSale = (tradePrice - inv.avgCost) * tradeShares;
        
        success = true;
        return { ...inv, shares: newShares, realizedProfit: (inv.realizedProfit || 0) + profitFromSale };
      }
      return inv;
    }));

    // If trade modified holdings correctly, log cashflow
    if (success) {
       addTransaction({
         type: trade.type === 'BUY' ? 'buy_investment' : 'sell_investment',
         amount: parseFloat(trade.shares) * parseFloat(trade.price),
         title: title,
         date: trade.date || new Date().toISOString(),
         categoryId: 'trade', // Special bypass
         notes: `Exec price: ${trade.price}`
       });
       addNotification({ title: 'Trade Executed', message: title, isRead: false, date: new Date().toISOString(), id: uuidv4() });
    }
  };

  const getCategory = (id) => categories.find(c => c.id === id);

  const addNotification = (n) => setNotifications(prev => [{ ...n, id: uuidv4(), date: new Date().toISOString(), isRead: false }, ...prev]);
  const markAsRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  const clearNotifications = () => setNotifications([]);

  return (
    <AppContext.Provider value={{
      transactions, categories, investments, notifications,
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

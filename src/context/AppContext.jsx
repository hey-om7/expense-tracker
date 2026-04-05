import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getFromStorage, saveToStorage, initialCategories, initialTransactions, initialInvestments } from '../services/dataService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [transactions, setTransactions] = useState(() => getFromStorage('transactions', initialTransactions));
  const [categories, setCategories] = useState(() => getFromStorage('categories', initialCategories));
  const [investments, setInvestments] = useState(() => getFromStorage('investments', initialInvestments));

  useEffect(() => {
    saveToStorage('transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    saveToStorage('categories', categories);
  }, [categories]);

  useEffect(() => {
    saveToStorage('investments', investments);
  }, [investments]);

  // Aggregate Data
  const totalBalance = transactions.reduce((acc, curr) => {
    return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
  }, 142850.32); // Using initial hardcoded base from UI for this demo

  const monthlySpent = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPortfolioValue = investments.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);

  // Actions
  const addTransaction = (t) => {
    setTransactions(prev => [{ ...t, id: uuidv4(), date: t.date || new Date().toISOString() }, ...prev]);
  };
  const deleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };
  const addCategory = (c) => setCategories(prev => [...prev, { ...c, id: uuidv4() }]);
  const addInvestment = (i) => setInvestments(prev => [...prev, { ...i, id: uuidv4() }]);

  const getCategory = (id) => categories.find(c => c.id === id);

  return (
    <AppContext.Provider value={{
      transactions, categories, investments,
      totalBalance, monthlySpent, totalPortfolioValue,
      addTransaction, deleteTransaction, addCategory, addInvestment, getCategory
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);

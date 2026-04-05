const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const request = async (endpoint, options = {}) => {
  const url = `${API_URL}/api${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(url, config);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || 'API request failed');
  }
  return response.json();
};

// ─── Transactions ───
export const fetchTransactions = () => request('/transactions');
export const createTransaction = (data) => request('/transactions', { method: 'POST', body: data });
export const updateTransaction = (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' });
export const deleteTransactionsByInvestment = (investmentId) => request(`/transactions/investment/${investmentId}`, { method: 'DELETE' });

// ─── Categories ───
export const fetchCategories = () => request('/categories');
export const createCategory = (data) => request('/categories', { method: 'POST', body: data });
export const updateCategory = (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

// ─── Investments ───
export const fetchInvestments = () => request('/investments');
export const createInvestment = (data) => request('/investments', { method: 'POST', body: data });
export const updateInvestment = (id, data) => request(`/investments/${id}`, { method: 'PUT', body: data });
export const deleteInvestment = (id) => request(`/investments/${id}`, { method: 'DELETE' });

// ─── Subscriptions ───
export const fetchSubscriptions = () => request('/subscriptions');
export const createSubscription = (data) => request('/subscriptions', { method: 'POST', body: data });
export const updateSubscription = (id, data) => request(`/subscriptions/${id}`, { method: 'PUT', body: data });
export const deleteSubscription = (id) => request(`/subscriptions/${id}`, { method: 'DELETE' });
export const runSubscriptionCheck = () => request('/subscriptions/run-check', { method: 'POST' });

// ─── Credit Cards ───
export const fetchCreditCards = () => request('/credit-cards');
export const createCreditCard = (data) => request('/credit-cards', { method: 'POST', body: data });
export const updateCreditCard = (id, data) => request(`/credit-cards/${id}`, { method: 'PUT', body: data });
export const deleteCreditCard = (id) => request(`/credit-cards/${id}`, { method: 'DELETE' });

// ─── Notifications ───
export const fetchNotifications = () => request('/notifications');
export const createNotification = (data) => request('/notifications', { method: 'POST', body: data });
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: 'PUT' });
export const markAllNotificationsRead = () => request('/notifications/mark-all-read', { method: 'PUT' });
export const clearAllNotifications = () => request('/notifications', { method: 'DELETE' });

// ─── Stocks (Yahoo Finance) ───
export const searchStocks = (query) => request(`/stocks/search?q=${encodeURIComponent(query)}`);
export const fetchStockQuote = (symbol) => request(`/stocks/quote/${encodeURIComponent(symbol)}`);

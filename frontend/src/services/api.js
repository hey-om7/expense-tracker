// Trailing slashes are stripped so "https://host/" doesn't produce "https://host//api/..."
const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

// Pages that work without a session; a 401 there must not bounce to /login.
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

const request = async (endpoint, { redirectOn401 = true, ...options } = {}) => {
  const url = `${API_URL}/api${endpoint}`;
  const config = {
    ...options,
    // The session is an httpOnly cookie; JavaScript never sees the token.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Required by the server's CSRF check on POST/PUT/DELETE
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {}),
    },
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(url, config);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || (response.status === 401 ? 'Session expired' : 'API request failed'));
    error.status = response.status;
    error.code = data.code;
    if (response.status === 401 && redirectOn401 &&
        !PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))) {
      window.location.href = '/login';
    }
    throw error;
  }
  return response.json();
};

// ─── Auth ───
export const loginUser = (data) => request('/auth/login', { method: 'POST', body: data });
export const registerUser = (data) => request('/auth/register', { method: 'POST', body: data });
export const googleAuth = (data) => request('/auth/google', { method: 'POST', body: data });
export const getMe = () => request('/auth/me', { redirectOn401: false });
export const logoutUser = () => request('/auth/logout', { method: 'POST', redirectOn401: false });
export const verifyEmail = (token) => request(`/auth/verify-email/${encodeURIComponent(token)}`, { method: 'POST' });
export const resendVerification = (email) => request('/auth/resend-verification', { method: 'POST', body: { email } });
export const forgotPassword = (email) => request('/auth/forgot-password', { method: 'POST', body: { email } });
export const resetPassword = (token, password) => request(`/auth/reset-password/${encodeURIComponent(token)}`, { method: 'POST', body: { password } });

// ─── Transactions ───
export const fetchTransactions = () => request('/transactions');
export const createTransaction = (data) => request('/transactions', { method: 'POST', body: data });
export const updateTransaction = (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' });

// ─── Settings APIs ───
export const fetchSettings = () => request('/settings');
export const updateSettings = (settingsData) => request('/settings', { method: 'PUT', body: settingsData });

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

// ─── Investment Trades (Holdings) ───
export const executeInvestmentTrade = (investmentId, tradeData) => request(`/investments/${investmentId}/trade`, { method: 'POST', body: tradeData });
export const deleteInvestmentHolding = (investmentId, holdingId) => request(`/investments/${investmentId}/holdings/${holdingId}`, { method: 'DELETE' });

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
export const fetchStockHistory = (symbol, range) => request(`/stocks/history/${encodeURIComponent(symbol)}?range=${range}`);

// ─── Gmail statements (per-user Google OAuth) ───
export const fetchGmailStatus = () => request('/gmail/status');
export const connectGmail = () => request('/gmail/connect', { method: 'POST' });
export const disconnectGmail = () => request('/gmail/disconnect', { method: 'POST' });
export const scanGmailBills = (full = false) => request('/gmail/scan-bills', { method: 'POST', body: { full } });
export const fetchCardStatements = (params = {}) =>
  request(`/gmail/statements?${new URLSearchParams(params).toString()}`);
export const addCardFromStatement = (id, data) =>
  request(`/gmail/statements/${id}/add-card`, { method: 'POST', body: data });
export const ignoreStatementCard = (id) =>
  request(`/gmail/statements/${id}/ignore`, { method: 'POST' });
export const fetchFinancialEmails = (status = 'review') =>
  request(`/gmail/emails?${new URLSearchParams({ status }).toString()}`);
export const dismissFinancialEmail = (id) => request(`/gmail/emails/${id}/dismiss`, { method: 'POST' });
export const dismissAllFinancialEmails = () => request('/gmail/emails/dismiss-all', { method: 'POST' });
export const sendAiChat = (message) => request('/ai/chat', { method: 'POST', body: { message } });

// ─── Onboarding ───
export const fetchOnboarding = () => request('/onboarding');
export const updateOnboarding = (data) => request('/onboarding', { method: 'PUT', body: data });
export const resetOnboarding = () => request('/onboarding/reset', { method: 'POST' });

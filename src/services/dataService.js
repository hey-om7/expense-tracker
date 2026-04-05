const STORAGE_PREFIX = 'espresso_reserve_';

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to local storage', error);
  }
};

export const getFromStorage = (key, defaultValue) => {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('Error reading from local storage', error);
    return defaultValue;
  }
};

export const initialCategories = [
  { id: '1', name: 'Dining', type: 'expense', color: '#3D332B', icon: 'restaurant' },
  { id: '2', name: 'Shopping', type: 'expense', color: '#E5BA73', icon: 'shopping_bag' },
  { id: '3', name: 'Salary', type: 'income', color: '#95CD41', icon: 'payments' },
  { id: '4', name: 'Housing', type: 'expense', color: '#67490b', icon: 'home' }
];

export const initialTransactions = [
  { id: 'tx1', amount: 24.50, categoryId: '1', type: 'expense', date: new Date().toISOString(), title: 'The Gilded Bean', notes: 'Lunch' },
  { id: 'tx2', amount: 500000, categoryId: '3', type: 'income', date: new Date().toISOString(), title: 'Initial Capital', notes: 'Seed startup cash' },
  { id: 'tx_buy_1', investmentId: 'inv1', shares: 450.5, price: 380.00, amount: 450.5 * 380, categoryId: 'trade', type: 'buy_investment', date: new Date().toISOString(), title: 'Bought 450.5 units of S&P 500 Index Fund' },
  { id: 'tx_buy_2', investmentId: 'inv2', shares: 1200, price: 70.50, amount: 1200 * 70.5, categoryId: 'trade', type: 'buy_investment', date: new Date().toISOString(), title: 'Bought 1200 units of Global Bond Fund' }
];

export const initialInvestments = [
  { id: 'inv1', name: 'S&P 500 Index Fund', symbol: 'VOO', currentPrice: 480.20, type: 'Stock' },
  { id: 'inv2', name: 'Global Bond Fund', symbol: 'BND', currentPrice: 72.10, type: 'Bond' }
];

export const initialNotifications = [
  { id: 'n1', title: 'Welcome to Wallo', message: 'Set up your first budget today.', isRead: false, date: new Date().toISOString() }
];

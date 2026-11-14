/**
 * Onboarding step definitions for each section of Vestor.
 * Each section has an array of steps with title, description, targetSelector, and icon.
 */

export const onboardingSteps = {
  dashboard: [
    {
      title: 'Welcome to Vestor',
      description: 'This is your financial command center. Get a bird\'s-eye view of your entire financial life — balance, spending, investments, and upcoming bills — all in one place.',
      targetSelector: null,
      icon: 'waving_hand',
    },
    {
      title: 'Balance & Spending',
      description: 'Your total available liquidity is displayed prominently at the top. Below, you can see your monthly spending breakdown by category with visual progress bars.',
      targetSelector: '[data-onboarding="dashboard-balance"]',
      icon: 'account_balance_wallet',
    },
    {
      title: 'Quick Actions',
      description: 'Use the Quick Add button to instantly log a new transaction. Your recent activity and upcoming bills are always visible so nothing catches you off guard.',
      targetSelector: '[data-onboarding="dashboard-actions"]',
      icon: 'bolt',
    },
  ],

  history: [
    {
      title: 'Transaction Ledger',
      description: 'Your complete financial history lives here. Every income, expense, and investment trade is logged and organized chronologically.',
      targetSelector: null,
      icon: 'receipt_long',
    },
    {
      title: 'Filter & Search',
      description: 'Use the powerful filter bar to search by name, filter by type, category, date, month, or year. Sort transactions by date or amount to find exactly what you need.',
      targetSelector: '[data-onboarding="history-filters"]',
      icon: 'filter_list',
    },
    {
      title: 'Edit Transactions',
      description: 'Click on any transaction to edit its details. You can update the title, amount, category, date, and notes — or delete it entirely.',
      targetSelector: '[data-onboarding="history-list"]',
      icon: 'edit_note',
    },
  ],

  investments: [
    {
      title: 'Portfolio Overview',
      description: 'Track all your investments in one place — stocks, mutual funds, crypto, and fixed deposits. Your portfolio value updates in real-time with live market prices.',
      targetSelector: null,
      icon: 'monitoring',
    },
    {
      title: 'Holdings & Live Prices',
      description: 'Each investment card shows units held, average cost, invested amount, and unrealized P/L. Stock and mutual fund prices update automatically.',
      targetSelector: '[data-onboarding="investments-holdings"]',
      icon: 'trending_up',
    },
    {
      title: 'Execute Trades',
      description: 'Use the Trade button to buy or sell units. Each trade is recorded as a transaction and your portfolio metrics recalculate instantly.',
      targetSelector: '[data-onboarding="investments-trade"]',
      icon: 'swap_vert',
    },
  ],

  cyclic: [
    {
      title: 'Recurring Payments',
      description: 'The Cyclic module tracks all your recurring financial obligations — subscriptions and credit card bills — so you never miss a payment.',
      targetSelector: null,
      icon: 'event_repeat',
    },
    {
      title: 'Subscriptions',
      description: 'Add and manage all your recurring subscriptions. Toggle them on/off, set renewal frequencies, and track costs. Vestor automatically generates transactions on renewal.',
      targetSelector: '[data-onboarding="cyclic-subs"]',
      icon: 'subscriptions',
    },
    {
      title: 'Credit Card Bills',
      description: 'Track your credit cards and their due dates. Cards approaching their due date are highlighted with warnings so you never miss a payment.',
      targetSelector: '[data-onboarding="cyclic-bills"]',
      icon: 'credit_card',
    },
  ],

  ai: [
    {
      title: 'Meet Vestor AI',
      description: 'Your personal AI finance assistant. Ask natural language questions about your spending, investments, subscriptions, and more — it has full context of your financial data.',
      targetSelector: null,
      icon: 'auto_awesome',
    },
    {
      title: 'Ask Anything',
      description: 'Try questions like "How much did I spend on food this month?" or "What\'s my best performing investment?". The AI analyzes your real data to give personalized answers.',
      targetSelector: null,
      icon: 'chat',
    },
  ],

  settings: [
    {
      title: 'Vestor AI',
      description: 'Everything in Settings is grouped here. Use the switch to turn the AI assistant on or off, or open the row to add your Groq API key and pick a model. Your key is stored encrypted in your profile.',
      targetSelector: '[data-onboarding="settings-ai"]',
      icon: 'smart_toy',
    },
    {
      title: 'Notifications',
      description: 'Choose browser pop-ups, email reminders, and how many days before a credit card bill is due you hear about it.',
      targetSelector: '[data-onboarding="settings-notifications"]',
      icon: 'notifications',
    },
    {
      title: 'Tutorial Controls',
      description: 'Replay this tour anytime or reset your progress from App Guide & Walkthroughs. That\'s it, enjoy using Vestor! 🎉',
      targetSelector: '[data-onboarding="settings-tutorial"]',
      icon: 'school',
    },
  ],
};

/** Ordered list of sections for progressive onboarding */
export const sectionOrder = ['dashboard', 'history', 'investments', 'cyclic', 'ai', 'settings'];

/** Map section name to onboarding flag key */
export const sectionToFlag = {
  dashboard: 'dashboardSeen',
  history: 'historySeen',
  investments: 'investmentsSeen',
  cyclic: 'cyclicSeen',
  ai: 'aiSeen',
  settings: 'settingsSeen',
};

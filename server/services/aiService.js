const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

const getModel = () => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured. Please set a valid API key in your .env file.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};

/**
 * Chat with Gemini using user-specific financial data as context.
 * @param {string} userMessage - The user's question
 * @param {object} userData - { transactions, investments, subscriptions, creditCards, userName }
 * @returns {string} AI response text
 */
const chatWithGemini = async (userMessage, userData) => {
  const model = getModel();

  // Build financial context summary
  const txSummary = buildTransactionSummary(userData.transactions || []);
  const invSummary = buildInvestmentSummary(userData.investments || []);
  const subSummary = buildSubscriptionSummary(userData.subscriptions || []);
  const ccSummary = buildCreditCardSummary(userData.creditCards || []);

  const systemPrompt = `You are Wallo AI, a friendly and knowledgeable personal finance assistant embedded in the Wallo expense tracking app. You help users understand their spending, investments, subscriptions, and bills.

Always be helpful, concise, and actionable. Use ₹ (Indian Rupees) for currency. If you don't have enough data to answer, say so honestly.

Here is ${userData.userName || 'the user'}'s current financial data:

=== TRANSACTIONS (Recent 50) ===
${txSummary}

=== INVESTMENTS ===
${invSummary}

=== SUBSCRIPTIONS ===
${subSummary}

=== CREDIT CARDS ===
${ccSummary}

Answer the user's question based on this data. Keep responses concise (under 300 words) and formatted for readability.`;

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + userMessage }] },
    ],
  });

  const response = result.response;
  return response.text();
};

function buildTransactionSummary(transactions) {
  if (transactions.length === 0) return 'No transactions recorded yet.';
  const recent = transactions.slice(0, 50);
  const totalIncome = recent.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = recent.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lines = recent.map(t =>
    `- ${new Date(t.date).toLocaleDateString('en-IN')}: ${t.type.toUpperCase()} ₹${t.amount} — ${t.title || 'Untitled'}${t.notes ? ` (${t.notes})` : ''}`
  );
  return `Total Income (recent): ₹${totalIncome.toFixed(2)}\nTotal Expenses (recent): ₹${totalExpense.toFixed(2)}\n${lines.join('\n')}`;
}

function buildInvestmentSummary(investments) {
  if (investments.length === 0) return 'No investments tracked.';
  return investments.map(i =>
    `- ${i.name} (${i.type}): ${i.shares || 0} units @ ₹${i.currentPrice || 0} | Symbol: ${i.symbol || 'N/A'}`
  ).join('\n');
}

function buildSubscriptionSummary(subscriptions) {
  if (subscriptions.length === 0) return 'No subscriptions tracked.';
  return subscriptions.map(s =>
    `- ${s.name}: ₹${s.amount} / ${s.period} | Active: ${s.isActive ? 'Yes' : 'No'} | Start: ${s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN') : 'N/A'}${s.expiryDate ? ` | Expires: ${new Date(s.expiryDate).toLocaleDateString('en-IN')}` : ''}`
  ).join('\n');
}

function buildCreditCardSummary(creditCards) {
  if (creditCards.length === 0) return 'No credit cards tracked.';
  return creditCards.map(c =>
    `- ${c.name} (****${c.last4Digits}): Due Date: ${new Date(c.billDueDate).toLocaleDateString('en-IN')} | Limit: ₹${c.totalLimit || 0}`
  ).join('\n');
}

module.exports = { chatWithGemini };

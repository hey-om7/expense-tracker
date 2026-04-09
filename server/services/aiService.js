const { GoogleGenerativeAI } = require('@google/generative-ai');

const getModel = (options = {}) => {
  const apiKey = options.apiKey;
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Please add your API key in Settings.');
  }
  
  const ai = new GoogleGenerativeAI(apiKey);
  const allowedModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-pro-latest'];
  const modelName = allowedModels.includes(options.model) ? options.model : 'gemini-2.5-flash';
  return ai.getGenerativeModel({ model: modelName });
};

const chatWithGemini = async (userMessage, userData, options = {}) => {
  const model = getModel(options);

  // Build financial context summary
  const catSummary = buildCategoriesSummary(userData.categories || []);
  const txSummary = buildTransactionSummary(userData.transactions || []);
  const invSummary = buildInvestmentSummary(userData.investments || []);
  const subSummary = buildSubscriptionSummary(userData.subscriptions || []);
  const ccSummary = buildCreditCardSummary(userData.creditCards || []);

  const systemPrompt = `You are Wallo AI, a friendly and knowledgeable personal finance assistant embedded in the Wallo expense tracking app. You help users understand their spending, investments, subscriptions, and bills.

Always be helpful, concise, and actionable. Use ₹ (Indian Rupees) for currency. If you don't have enough data to answer, say so honestly. NEVER invent data or share other users' information.

Here is ${userData.userName || 'the user'}'s current financial data:

=== CATEGORIES ===
${catSummary}

=== TRANSACTIONS (Recent 50) ===
${txSummary}

=== INVESTMENTS ===
${invSummary}

=== SUBSCRIPTIONS ===
${subSummary}

=== CREDIT CARDS ===
${ccSummary}

Answer the user's question based on this data. Keep responses concise (under 300 words) and formatted for readability.`;
  console.log(`AI Model hit: ${options.model || 'gemini-2.5-flash'}`);
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + userMessage }] },
    ],
  });

  const response = result.response;
  return response.text();
};

function buildCategoriesSummary(categories) {
  if (categories.length === 0) return 'No custom categories created.';
  return categories.map(c => `- ${c.name} (${c.type.toUpperCase()})`).join('\n');
}

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
  return investments.map(i => {
    // Compute quantity from holdings dynamically for AI representation
    let quantity = 0;
    if (i.holdings && Array.isArray(i.holdings)) {
      i.holdings.forEach(h => {
        if (h.type === 'BUY') quantity += h.quantity || 0;
        if (h.type === 'SELL') quantity -= h.quantity || 0;
      });
    }
    return `- ${i.name} (${i.type}): ${quantity} units @ Live Nav ₹${i.currentPrice || 0} | Symbol: ${i.symbol || 'N/A'}`;
  }).join('\n');
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

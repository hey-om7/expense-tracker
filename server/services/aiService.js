const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk'); // ADDED GROQ IMPORT

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

// --- GEMINI SERVICE ---
const chatWithGemini = async (userMessage, userData, options = {}) => {
  const model = getModel(options);

  const catSummary = buildCategoriesSummary(userData.categories || []);
  const txSummary = buildTransactionSummary(userData.transactions || []);
  const invSummary = buildInvestmentSummary(userData.investments || []);
  const subSummary = buildSubscriptionSummary(userData.subscriptions || []);
  const ccSummary = buildCreditCardSummary(userData.creditCards || []);

  const systemPrompt = buildSystemPrompt(userData.userName, catSummary, txSummary, invSummary, subSummary, ccSummary);

  console.log(`AI Model hit (Gemini): ${options.model || 'gemini-2.5-flash'}`);
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + userMessage }] },
    ],
  });

  const response = result.response;
  return response.text();
};

// --- GROQ SERVICE ---
const chatWithGroq = async (userMessage, userData, options = {}) => {
  const apiKey = options.apiKey;
  if (!apiKey) {
    throw new Error('No Groq API key configured. Please add your API key in Settings.');
  }

  const groq = new Groq({ apiKey });
  const modelName = options.model || 'llama-3.1-8b-instant';

  const catSummary = buildCategoriesSummary(userData.categories || []);
  const txSummary = buildTransactionSummary(userData.transactions || []);
  const invSummary = buildInvestmentSummary(userData.investments || []);
  const subSummary = buildSubscriptionSummary(userData.subscriptions || []);
  const ccSummary = buildCreditCardSummary(userData.creditCards || []);

  const systemPrompt = buildSystemPrompt(userData.userName, catSummary, txSummary, invSummary, subSummary, ccSummary);

  console.log(`AI Model hit (Groq): ${modelName}`);
  
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    model: modelName,
    temperature: 0.7,
    max_tokens: 1024,
  });

  return chatCompletion.choices[0]?.message?.content || 'No response from AI.';
};

// --- HELPER FUNCTIONS ---
function buildSystemPrompt(userName, cat, tx, inv, sub, cc) {
  return `You are Vestor AI, a friendly and knowledgeable personal finance assistant embedded in the Vestor expense tracking app. You help users understand their spending, investments, subscriptions, and bills.

Always be helpful, concise, and actionable. Use ₹ (Indian Rupees) for currency. If you don't have enough data to answer, say so honestly. NEVER invent data or share other users' information.

Here is ${userName || 'the user'}'s current financial data:

=== CATEGORIES ===
${cat}

=== TRANSACTIONS ===
${tx}

=== INVESTMENTS ===
${inv}

=== SUBSCRIPTIONS ===
${sub}

=== CREDIT CARDS ===
${cc}

Answer the user's question based on this data. Keep responses concise (under 300 words) and formatted for readability.`;
}

function buildCategoriesSummary(categories) {
  if (categories.length === 0) return 'No custom categories created.';
  return categories.map(c => `- ${c.name} (${c.type.toUpperCase()})`).join('\n');
}

function buildTransactionSummary(transactions) {
  if (transactions.length === 0) return 'No transactions recorded yet.';
  
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  // Sort chronologically (oldest to newest) so the AI understands time progression
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  const lines = sortedTxs.map(t => {
    const txDate = t.date ? new Date(t.date).toLocaleDateString('en-IN') : 'Unknown Date';
    // If you populate categories, this will grab the name, otherwise it falls back to title
    const categoryInfo = t.category?.name ? ` | Category: ${t.category.name}` : '';
    const notesInfo = t.notes ? ` | Notes: ${t.notes}` : '';
    
    return `- Date: ${txDate} | Type: ${t.type.toUpperCase()} | Amount: ₹${t.amount} | Title: ${t.title || 'Untitled'}${categoryInfo}${notesInfo}`;
  });

  return `Total Income: ₹${totalIncome.toFixed(2)}\nTotal Expenses: ₹${totalExpense.toFixed(2)}\n\nTransaction History (Chronological):\n${lines.join('\n')}`;
}

function buildInvestmentSummary(investments) {
  if (investments.length === 0) return 'No investments tracked.';
  
  return investments.map(i => {
    let quantity = 0;
    let historyLines = [];
    
    if (i.holdings && Array.isArray(i.holdings)) {
      // 1. Sort holdings strictly by date (oldest first) so AI knows the timeline
      const sortedHoldings = [...i.holdings].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      sortedHoldings.forEach(h => {
        if (h.type === 'BUY') quantity += h.quantity || 0;
        if (h.type === 'SELL') quantity -= h.quantity || 0;
        
        // 2. Explicitly extract and label the holding's date
        const txDate = h.date ? new Date(h.date).toLocaleDateString('en-IN') : 'Unknown Date';
        
        historyLines.push(`    - ${h.type}: ${h.quantity} units @ ₹${h.price || 0} (Transaction Date: ${txDate})`);
      });
    }
    
    let summary = `- ${i.name} (${i.type}): Total ${quantity} units @ Live Nav ₹${i.currentPrice || 0} | Symbol: ${i.symbol || 'N/A'}`;
    
    if (historyLines.length > 0) {
      summary += `\n  History (Chronological):\n${historyLines.join('\n')}`;
    }
    return summary;
  }).join('\n\n');
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

module.exports = { chatWithGemini, chatWithGroq };
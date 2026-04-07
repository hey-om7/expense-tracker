import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddTransactionForm = ({ onClose, initialData }) => {
  const { addTransaction, updateTransaction, deleteTransaction, categories } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type === 'buy_investment' ? 'expense' : initialData.type === 'sell_investment' ? 'income' : initialData.type);
      setAmount(initialData.amount || '');
      setCategoryId(initialData.categoryId || '');
      setTitle(initialData.title || '');
      setNotes(initialData.notes || '');
      setDate(new Date(initialData.date).toISOString().split('T')[0] || '');
    }
  }, [initialData]);

  const evaluateExpression = (expr) => {
    if (!expr) return '';
    // Clean input: only digits, dots, plus, minus
    const cleanExpr = expr.toString().replace(/[^0-9+\-.]/g, '');
    if (!cleanExpr) return '';

    try {
      // Simple parser for + and -
      const parts = cleanExpr.split(/([+\-])/).filter(p => p.trim() !== '');
      if (parts.length === 0) return '';

      let result = parseFloat(parts[0]) || 0;
      for (let i = 1; i < parts.length; i += 2) {
        const operator = parts[i];
        const nextVal = parseFloat(parts[i + 1]) || 0;
        if (operator === '+') result += nextVal;
        if (operator === '-') result -= nextVal;
      }
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    } catch (e) {
      return cleanExpr;
    }
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    // Only allow numbers, plus, minus, and dot
    if (/^[0-9+\-.]*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleAmountBlur = () => {
    if (amount.includes('+') || amount.includes('-')) {
      setAmount(evaluateExpression(amount));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalAmount = evaluateExpression(amount);
    if (!finalAmount || !categoryId || !title) return;
    
    // Safety check for trade modifications. Disallow editing amount/type/category of trade logs through this form directly, just title/notes/date.
    if (isEditing && (initialData.type === 'buy_investment' || initialData.type === 'sell_investment')) {
        updateTransaction(initialData.id, {
            title, notes, date: new Date(date).toISOString()
        });
        onClose();
        return;
    }

    const payload = {
      type,
      amount: parseFloat(finalAmount),
      categoryId,
      title,
      notes,
      date: new Date(date).toISOString()
    };

    if (isEditing) {
      updateTransaction(initialData.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };
  
  const handleDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    deleteTransaction(initialData.id);
    onClose();
  };

  const currentCategories = categories.filter(c => c.type === type);
  const isTradeLog = isEditing && (initialData.type === 'buy_investment' || initialData.type === 'sell_investment');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isTradeLog && (
         <div className="bg-primary/20 text-on-surface p-3 text-xs rounded-lg mb-2 border border-primary/50">
           <strong>Notice:</strong> This is an investment trade log. You can only update its title, notes, and date here. To reverse financial impact, delete it and adjust holdings manually.
         </div>
      )}

      {!isTradeLog && (
        <div className="relative flex bg-surface-container-highest p-1 rounded-xl w-full h-12">
          {/* Sliding Background */}
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] transition-all duration-300 ease-out z-0
              ${type === 'expense' ? 'left-1 bg-error-container rounded-l-lg rounded-r-[4px]' : 'left-[calc(50%)] bg-tertiary-container rounded-r-lg rounded-l-[4px]'}
            `}
          />
          
          <button 
            type="button" 
            onClick={() => setType('expense')} 
            className={`flex-1 relative z-10 py-2 text-sm font-bold transition-colors duration-300 ${type === 'expense' ? 'text-on-error-container' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Expense
          </button>
          
          <button 
            type="button" 
            onClick={() => setType('income')} 
            className={`flex-1 relative z-10 py-2 text-sm font-bold transition-colors duration-300 ${type === 'income' ? 'text-on-tertiary-container' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Income
          </button>
        </div>
      )}

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Amount *</label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
          <input 
            type="text" 
            value={amount} 
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            disabled={isTradeLog} 
            className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50" 
            placeholder="0.00" 
            required 
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Category *</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={isTradeLog} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-4 pr-10 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23E5BA73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat" required>
          <option value="" disabled>Select a category</option>
          {isTradeLog && <option value="trade">Investment Trade</option>}
          {currentCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Date *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="What was this for?" required />
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Notes (Optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="Any details..." />
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={handleDelete} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Save Changes' : 'Add Transaction'}
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm} 
        title="Confirm Deletion" 
        message="Are you sure you want to delete this record? This action cannot be officially undone." 
        onConfirm={confirmDelete} 
        onCancel={() => setShowConfirm(false)} 
      />
    </form>
  );
};

export default AddTransactionForm;

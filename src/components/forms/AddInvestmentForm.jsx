import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddInvestmentForm = ({ onClose, initialData }) => {
  const { addInvestment, updateInvestment, deleteInvestment, addNotification } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [comments, setComments] = useState('');
  const [type, setType] = useState('Stock');

  // Removed shares and avgCost from local state since they are not permanently 
  // stored on profiles anymore! Those are driven strictly by execution orders.

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setSymbol(initialData.symbol || '');
      setComments(initialData.comments || '');
      setType(initialData.type || 'Stock');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !symbol) return;

    const payload = {
      name,
      symbol,
      comments,
      type
    };

    if (isEditing) {
      updateInvestment(initialData.id, payload);
      addNotification({ title: 'Investment Updated', message: `Modified properties for ${name}.` });
    } else {
      // Safe-guard currentPrice logically initializing it to 0 so math doesn't crash 
      // globally. True pricing will trace from trading dynamically or future updates.
      addInvestment({ ...payload, currentPrice: 0 });
      addNotification({ title: 'Investment Profile Created', message: `Successfully tracked ${name}. You can now execute trades on it.` });
    }

    onClose();
  };

  const handleDelete = () => setShowConfirm(true);

  const confirmDelete = () => {
    deleteInvestment(initialData.id);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-6 no-scrollbar">
      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Type</label>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary">
          <option value="Stock">Stocks</option>
          <option value="Mutual Fund">Mutual Funds</option>
          <option value="Crypto">Crypto</option>
          <option value="FD">Fixed Deposit</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
            Ticker / Symbol *
          </label>
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Comments</label>
        <textarea rows={3} value={comments} onChange={e => setComments(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary resize-none" placeholder="Any strategic notes on this holding..." />
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
          <button type="button" onClick={handleDelete} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
            Delete
          </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Update Configuration' : 'Create Holding'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirm Deletion"
        message="Are you sure you want to delete this investment profile entirely? This will also wipe out the related historical trades seamlessly correcting your liquidity metrics natively."
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </form>
  );
};

export default AddInvestmentForm;

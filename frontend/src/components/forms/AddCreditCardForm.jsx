import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddCreditCardForm = ({ onClose, initialData }) => {
  const { addCreditCard, updateCreditCard, deleteCreditCard, addNotification } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalLimit, setTotalLimit] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setLast4Digits(initialData.last4Digits || '');
      setBillDueDate(initialData.billDueDate ? new Date(initialData.billDueDate).toISOString().split('T')[0] : '');
      setTotalLimit(initialData.totalLimit || '');
      setNotes(initialData.notes || '');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !last4Digits || !billDueDate) return;
    
    // limit 4 digits
    const cleanDigits = last4Digits.substring(0, 4);

    const payload = {
      name,
      last4Digits: cleanDigits,
      billDueDate: new Date(billDueDate).toISOString(),
      totalLimit: totalLimit ? parseFloat(totalLimit) : 0,
      notes
    };

    if (isEditing) {
      updateCreditCard(initialData.id, payload);
      addNotification({ title: 'Credit Card Updated', message: `Modified properties for ${name}` });
    } else {
      addCreditCard(payload);
      addNotification({ title: 'Credit Card Registered', message: `Began tracking ${name} ending in ${cleanDigits}` });
    }
    
    onClose();
  };

  const confirmDelete = () => {
    deleteCreditCard(initialData.id);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-8 no-scrollbar">
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Card Title *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="e.g. HDFC Regalia" required />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Last 4 Digits *</label>
          <input type="number" value={last4Digits} onChange={e => setLast4Digits(e.target.value.slice(0, 4))} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="XXXX" max="9999" required />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
           <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Bill Due Date *</label>
           <input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Total Limit (Optional)</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
            <input type="number" step="0.01" value={totalLimit} onChange={e => setTotalLimit(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Notes / Features (Optional)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary resize-none" placeholder="Lounge access limitations..." />
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={() => setShowConfirm(true)} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Save Configuration' : 'Track Card'}
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm} 
        title="Delete Credit Card" 
        message="Are you sure you want to stop tracking this credit card?" 
        onConfirm={confirmDelete} 
        onCancel={() => setShowConfirm(false)} 
      />
    </form>
  );
};

export default AddCreditCardForm;

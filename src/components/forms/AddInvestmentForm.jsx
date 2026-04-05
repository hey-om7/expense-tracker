import React, { useState, useEffect, useRef } from 'react';
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
  const [currentPrice, setCurrentPrice] = useState(0);

  // MF Live Search States
  const [mfQuery, setMfQuery] = useState('');
  const [mfResults, setMfResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setSymbol(initialData.symbol || '');
      setComments(initialData.comments || '');
      setType(initialData.type || 'Stock');
      setCurrentPrice(initialData.currentPrice || 0);

      if (initialData.type === 'Mutual Fund') {
         setMfQuery(`${initialData.symbol} - ${initialData.name}`);
      }
    }
  }, [initialData]);

  const handleMfSearch = (query) => {
    setMfQuery(query);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
       setMfResults([]);
       setIsSearching(false);
       return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
       try {
          const res = await fetch(`https://api.mfapi.in/mf/search?q=${query}`);
          const data = await res.json();
          setMfResults(data);
       } catch (err) {
          console.error("Failed to search mutual funds:", err);
       } finally {
          setIsSearching(false);
       }
    }, 300);
  };

  const handleMfSelect = async (fund) => {
    setMfQuery(fund.schemeName);
    setShowDropdown(false);
    
    // Autofill internal states
    setName(fund.schemeName);
    setSymbol(fund.schemeCode.toString());

    // Fetch initial NAV concurrently so it's ready upon creation execution
    try {
       const res = await fetch(`https://api.mfapi.in/mf/${fund.schemeCode}/latest`);
       const latestData = await res.json();
       if (latestData && latestData.data && latestData.data.length > 0) {
          setCurrentPrice(parseFloat(latestData.data[0].nav));
       }
    } catch (e) {
       console.error("Failed to fetch initial NAV", e);
    }
  };

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
      // Pass the fully loaded NAV directly into tracking database securely.
      addInvestment({ ...payload, currentPrice: type === 'Mutual Fund' ? currentPrice : 0 });
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
        <select value={type} onChange={e => {
            setType(e.target.value); 
            if (e.target.value !== 'Mutual Fund') {
               setMfQuery('');
               setName('');
               setSymbol('');
            }
          }} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary">
          <option value="Stock">Stocks</option>
          <option value="Mutual Fund">Mutual Funds</option>
          <option value="Crypto">Crypto</option>
          <option value="FD">Fixed Deposit</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {type === 'Mutual Fund' ? (
        <div className="relative">
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Search Fund Library *</label>
          <input 
             type="text" 
             value={mfQuery} 
             onChange={e => handleMfSearch(e.target.value)} 
             placeholder="Search by AMC or Name (e.g., SBI Small Cap)"
             className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" 
             required 
             autoComplete="off"
          />
          {showDropdown && (mfQuery.length > 0) && (
             <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto py-2 z-50">
               {isSearching ? (
                 <p className="px-4 py-3 text-sm text-on-surface-variant italic">Searching framework...</p>
               ) : mfResults.length > 0 ? (
                 mfResults.map(fund => (
                   <div 
                     key={fund.schemeCode} 
                     onClick={() => handleMfSelect(fund)}
                     className="px-4 py-3 hover:bg-primary/20 cursor-pointer text-sm border-b border-outline/5 last:border-0"
                   >
                     <p className="font-bold text-on-surface">{fund.schemeName}</p>
                     <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Code Mapping: {fund.schemeCode}</p>
                   </div>
                 ))
               ) : (
                 <p className="px-4 py-3 text-sm text-on-surface-variant">No mutual funds matching request.</p>
               )}
             </div>
          )}
        </div>
      ) : (
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
      )}

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

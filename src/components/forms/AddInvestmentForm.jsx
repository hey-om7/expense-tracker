import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import * as api from '../../services/api';

const AddInvestmentForm = ({ onClose, initialData }) => {
  const { addInvestment, updateInvestment, deleteInvestment, addNotification } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [comments, setComments] = useState('');
  const [type, setType] = useState('Stock');
  const [currentPrice, setCurrentPrice] = useState(0);

  // Live Search States (Shared between MF & Stock)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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

      if (initialData.type === 'Mutual Fund' || initialData.type === 'Stock') {
         setSearchQuery(`${initialData.symbol} - ${initialData.name}`);
      }
    }
  }, [initialData]);

  const handleLiveSearch = (query) => {
    setSearchQuery(query);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
       setSearchResults([]);
       setIsSearching(false);
       return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
       try {
          if (type === 'Mutual Fund') {
            const res = await fetch(`https://api.mfapi.in/mf/search?q=${query}`);
            const data = await res.json();
            setSearchResults(data);
          } else if (type === 'Stock') {
            const data = await api.searchStocks(query);
            setSearchResults(data);
          }
       } catch (err) {
          console.error(`Failed to search ${type.toLowerCase()}s:`, err);
          setSearchResults([]);
       } finally {
          setIsSearching(false);
       }
    }, 400);
  };

  const handleSelectResult = async (asset) => {
    setShowDropdown(false);
    
    if (type === 'Mutual Fund') {
      setSearchQuery(asset.schemeName);
      setName(asset.schemeName);
      setSymbol(asset.schemeCode.toString());

      try {
         const res = await fetch(`https://api.mfapi.in/mf/${asset.schemeCode}/latest`);
         const latestData = await res.json();
         if (latestData && latestData.data && latestData.data.length > 0) {
            setCurrentPrice(parseFloat(latestData.data[0].nav));
         }
      } catch (e) {
         console.error("Failed to fetch initial NAV", e);
      }
    } 
    else if (type === 'Stock') {
      setSearchQuery(`${asset.symbol} - ${asset.name}`);
      setName(asset.name);
      setSymbol(asset.symbol);

      try {
         const quote = await api.fetchStockQuote(asset.symbol);
         if (quote && quote.price) {
           setCurrentPrice(parseFloat(quote.price));
         }
      } catch (e) {
         console.error("Failed to fetch live stock quote", e);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !symbol) {
      addNotification({ title: 'Validation Error', message: 'You must select a valid asset symbol to track it.' });
      return;
    }

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
      addInvestment({ ...payload, currentPrice: (type === 'Mutual Fund' || type === 'Stock') ? currentPrice : 0 });
      addNotification({ title: 'Investment Profile Created', message: `Successfully tracked ${name}. You can now execute trades on it.` });
    }

    onClose();
  };

  const handleDelete = () => setShowConfirm(true);

  const confirmDelete = () => {
    deleteInvestment(initialData.id);
    onClose();
  };

  const isSearchable = type === 'Mutual Fund' || type === 'Stock';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-6 no-scrollbar">
      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Type</label>
        <select value={type} onChange={e => {
            setType(e.target.value); 
            if (e.target.value !== 'Mutual Fund' && e.target.value !== 'Stock') {
               setSearchQuery('');
               setName('');
               setSymbol('');
            } else {
               setSearchQuery('');
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

      {isSearchable ? (
        <div className="relative">
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Search Live Database *</label>
          <input 
             type="text" 
             value={searchQuery} 
             onChange={e => handleLiveSearch(e.target.value)} 
             placeholder={type === 'Stock' ? "Search by Company Name or Ticker (e.g. Reliance, TATAMOTORS.NS)" : "Search by AMC or Name (e.g., SBI Small Cap)"}
             className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" 
             required 
             autoComplete="off"
             disabled={isEditing}
          />
          {showDropdown && (searchQuery.length > 0) && (
             <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto py-2 z-50">
               {isSearching ? (
                 <p className="px-4 py-3 text-sm text-on-surface-variant italic">Searching framework...</p>
               ) : searchResults.length > 0 ? (
                 searchResults.map(res => {
                   const keyId = type === 'Mutual Fund' ? res.schemeCode : res.symbol;
                   const displayTitle = type === 'Mutual Fund' ? res.schemeName : res.name;
                   const displaySub = type === 'Mutual Fund' ? `Code: ${res.schemeCode}` : `Ticker: ${res.symbol} | Exchange: ${res.exchange || 'Unknown'}`;

                   return (
                     <div 
                       key={keyId} 
                       onClick={() => handleSelectResult(res)}
                       className="px-4 py-3 hover:bg-primary/20 cursor-pointer text-sm border-b border-outline/5 last:border-0"
                     >
                       <p className="font-bold text-on-surface">{displayTitle}</p>
                       <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">{displaySub}</p>
                     </div>
                   );
                 })
               ) : (
                 <p className="px-4 py-3 text-sm text-on-surface-variant">No results matching query.</p>
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
            Delete Profile
          </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Save Configuration' : 'Establish Position Link'}
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

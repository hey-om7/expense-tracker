import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/currency';

const InvestmentTradeForm = ({ onClose, investment, initialTradeData }) => {
  const { executeTrade, deleteTransaction } = useAppContext();
  
  // Tab logic: If we have initialTradeData, default to 'EDIT', else default to 'TRADE'
  const [activeTab, setActiveTab] = useState(initialTradeData ? 'EDIT' : 'TRADE');

  // Form State
  const [tradeId, setTradeId] = useState(initialTradeData?.id || null);
  const [type, setType] = useState('BUY');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState(investment.currentPrice || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Load initial data
  useEffect(() => {
    if (initialTradeData) {
       setTradeId(initialTradeData.id);
       setType(initialTradeData.type === 'buy_investment' ? 'BUY' : 'SELL');
       setShares(initialTradeData.shares || '');
       setPrice(initialTradeData.price || '');
       setDate(initialTradeData.date ? new Date(initialTradeData.date).toISOString().split('T')[0] : '');
       setActiveTab('EDIT');
    }
  }, [initialTradeData]);

  const resetForm = () => {
    setTradeId(null);
    setType('BUY');
    setShares('');
    setPrice(investment.currentPrice || '');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const startEdit = (trade) => {
    setTradeId(trade.id);
    setType(trade.type === 'buy_investment' ? 'BUY' : 'SELL');
    setShares(trade.shares);
    setPrice(trade.price);
    setDate(new Date(trade.date).toISOString().split('T')[0]);
    setActiveTab('EDIT');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shares || !price) return;
    
    executeTrade(investment.id, {
      type,
      shares: parseFloat(shares),
      price: parseFloat(price),
      date: new Date(date).toISOString()
    }, tradeId); // Pass tradeId for updates!
    
    // If not from main transaction page, stay alive and go to history tabs
    if (initialTradeData) {
       onClose();
    } else {
       resetForm();
       setActiveTab('HISTORY');
    }
  };

  const handleDeleteTrade = (id) => {
    if (window.confirm("Delete this trade? This will reverse its financial impact instantly.")) {
      deleteTransaction(id);
      if (initialTradeData) onClose();
      else resetForm();
    }
  };

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-hidden">
      {!initialTradeData && (
        <div className="flex border-b border-outline/10 text-sm font-bold">
          <button onClick={() => { setActiveTab('TRADE'); resetForm(); }} className={`flex-1 pb-2 border-b-2 transition-all ${activeTab === 'TRADE' || activeTab === 'EDIT' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            {activeTab === 'EDIT' ? 'Edit Trade' : 'New Order'}
          </button>
          <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 pb-2 border-b-2 transition-all ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            Trade History
          </button>
        </div>
      )}

      <div className="overflow-y-auto no-scrollbar flex-1 px-1">
        {(activeTab === 'TRADE' || activeTab === 'EDIT') && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            {!initialTradeData && activeTab === 'TRADE' && (
              <div className="flex bg-surface-container-highest p-1 rounded-lg mb-2">
                <button type="button" onClick={() => setType('BUY')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${type === 'BUY' ? 'bg-[#95CD41] text-[#1A120B]' : 'text-on-surface-variant'}`}>
                  Buy
                </button>
                <button type="button" onClick={() => setType('SELL')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${type === 'SELL' ? 'bg-error-container text-on-error-container' : 'text-on-surface-variant'}`}>
                  Sell
                </button>
              </div>
            )}
            {activeTab === 'EDIT' && (
               <div className={`p-3 text-center text-xs font-bold rounded-lg uppercase tracking-widest mb-2 ${type === 'BUY' ? 'bg-[#95CD41]/20 text-[#95CD41]' : 'bg-error-container text-on-error-container'}`}>
                 Editing {type} Order
               </div>
            )}

            {type === 'SELL' && (
               <div className="text-xs text-on-surface-variant pb-2">
                  Max available to sell: <span className="font-bold text-on-surface">{investment.shares} units</span>
               </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Quantity *</label>
                <input type="number" step="0.0001" max={type === 'SELL' && !tradeId ? investment.shares : undefined} value={shares} onChange={e => setShares(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Execution Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="0.00" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
            </div>

            <div className="mt-4 flex gap-3">
              {activeTab === 'EDIT' && (
                <button type="button" onClick={() => handleDeleteTrade(tradeId)} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
                  Delete
                </button>
              )}
              <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
                {activeTab === 'EDIT' ? 'Save Changes' : `Execute ${type}`}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'HISTORY' && (
           <div className="flex flex-col gap-2 pt-2">
             {(!investment.trades || investment.trades.length === 0) ? (
                <p className="text-sm text-center text-outline py-8">No trade history recorded.</p>
             ) : (
                investment.trades.map(trade => (
                  <div key={trade.id} onClick={() => startEdit(trade)} className={`cursor-pointer flex items-center justify-between p-3 rounded-lg border border-outline/10 hover:border-outline/30 transition-all ${trade.type === 'buy_investment' ? 'bg-[#95CD41]/5' : 'bg-error/5'}`}>
                     <div>
                        <div className="flex gap-2 items-center">
                           <span className={`text-[10px] uppercase tracking-wider font-bold ${trade.type === 'buy_investment' ? 'text-[#95CD41]' : 'text-error'}`}>{trade.type === 'buy_investment' ? 'BUY' : 'SELL'}</span>
                           <span className="text-sm font-bold">{trade.shares} <span className="text-xs text-outline font-normal">units</span></span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant">{new Date(trade.date).toLocaleDateString()}</span>
                     </div>
                     <div className="text-right">
                        <span className="block text-sm font-bold">{formatCurrency((trade.shares||0)*(trade.price||0))}</span>
                        <span className="block text-[10px] text-on-surface-variant">@ {formatCurrency(trade.price)}</span>
                     </div>
                  </div>
                ))
             )}
           </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentTradeForm;

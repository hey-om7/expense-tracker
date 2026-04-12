import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddSubscriptionForm from '../components/forms/AddSubscriptionForm';
import AddCreditCardForm from '../components/forms/AddCreditCardForm';

// Helper function to force DD/MM/YYYY format
const formatDateToDDMMYYYY = (dateString) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

const CyclicScreen = () => {
  const { subscriptions, creditCards, updateSubscription } = useAppContext();
  
  const [activeTab, setActiveTab] = useState('SUBSCRIPTIONS');
  const [subModal, setSubModal] = useState({ isOpen: false, data: null });
  const [ccModal, setCcModal] = useState({ isOpen: false, data: null });

  const isApproaching = (dateString, daysThreshold = 5) => {
     const today = new Date();
     today.setHours(0,0,0,0);
     const target = new Date(dateString);
     target.setHours(0,0,0,0);
     const diffTime = target - today;
     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
     return diffDays >= 0 && diffDays <= daysThreshold;
  };
  
  const isPastDue = (dateString) => {
     const today = new Date();
     today.setHours(0,0,0,0);
     const target = new Date(dateString);
     target.setHours(0,0,0,0);
     return target < today;
  };

  // ─── Sort subscriptions: active first, inactive/expired last ───
  const sortedSubscriptions = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      const aInactive = !a.isActive;
      const bInactive = !b.isActive;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return 0;
    });
  }, [subscriptions]);

  // ─── Sort credit cards: non-past-due first, past due last ───
  const sortedCreditCards = useMemo(() => {
    return [...creditCards].sort((a, b) => {
      const aPast = isPastDue(a.billDueDate);
      const bPast = isPastDue(b.billDueDate);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return 0;
    });
  }, [creditCards]);

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen max-md:px-4 max-md:pb-28">

      {/* ===== DESKTOP HEADER ===== */}
      <div className="hidden md:flex mb-10 flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Automation Engine</span>
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight">Cyclic</h1>
        </div>
        <div className="relative grid grid-cols-2 bg-surface-container-highest p-1 rounded-xl h-16 w-full md:w-auto overflow-hidden">
          <div 
            className={`absolute top-1 bottom-1 transition-all duration-300 ease-out z-0
              ${activeTab === 'SUBSCRIPTIONS' ? 'left-1 bg-primary rounded-l-lg rounded-r-[4px] shadow-lg shadow-primary/20' : 'left-[calc(50%+1px)] bg-error-container rounded-r-lg rounded-l-[4px] shadow-lg shadow-error-container/20'}
            `}
            style={{ width: 'calc(50% - 2px)' }}
          />
          <button 
            onClick={() => setActiveTab('SUBSCRIPTIONS')} 
            className={`relative z-10 py-1 text-sm font-bold transition-colors duration-300 flex items-center justify-center text-center px-4 ${activeTab === 'SUBSCRIPTIONS' ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Active Subscriptions
          </button>
          <button 
            onClick={() => setActiveTab('BILLS')} 
            className={`relative z-10 py-1 text-sm font-bold transition-colors duration-300 flex items-center justify-center text-center px-4 ${activeTab === 'BILLS' ? 'text-on-error-container' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Pending Bills (CC)
          </button>
        </div>
      </div>

      {/* ===== MOBILE HEADER ===== */}
      <div className="md:hidden mb-5">
        <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1 block">Automation Engine</span>
        <h1 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight mb-4">Cyclic</h1>
        <div className="relative grid grid-cols-2 bg-surface-container-highest p-1 rounded-lg h-11 overflow-hidden">
          <div 
            className={`absolute top-1 bottom-1 transition-all duration-300 ease-out z-0
              ${activeTab === 'SUBSCRIPTIONS' ? 'left-1 bg-primary rounded-[6px] shadow-md shadow-primary/20' : 'left-[calc(50%+1px)] bg-error-container rounded-[6px] shadow-md shadow-error-container/20'}
            `}
            style={{ width: 'calc(50% - 2px)' }}
          />
          <button 
            onClick={() => setActiveTab('SUBSCRIPTIONS')} 
            className={`relative z-10 text-xs font-bold transition-colors duration-300 flex items-center justify-center ${activeTab === 'SUBSCRIPTIONS' ? 'text-on-primary' : 'text-on-surface-variant'}`}
          >
            Subscriptions
          </button>
          <button 
            onClick={() => setActiveTab('BILLS')} 
            className={`relative z-10 text-xs font-bold transition-colors duration-300 flex items-center justify-center ${activeTab === 'BILLS' ? 'text-on-error-container' : 'text-on-surface-variant'}`}
          >
            Bills (CC)
          </button>
        </div>
      </div>

      {/* ===== SUBSCRIPTIONS TAB ===== */}
      {activeTab === 'SUBSCRIPTIONS' && (
         <section className="animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6 max-md:mb-4">
               <h3 className="font-headline font-bold text-xl max-md:text-base">Subscriptions ({subscriptions.length})</h3>
               <button onClick={() => setSubModal({isOpen: true, data: null})} className="text-sm font-bold text-primary flex items-center gap-1 hover:brightness-125 transition-all max-md:text-xs">
                 <span className="material-symbols-outlined text-sm">add</span> Add Sub
               </button>
            </div>
            
            {sortedSubscriptions.length === 0 ? (
               <div className="text-center py-16 bg-surface-container-low rounded-xl border border-dashed border-outline/20 max-md:py-10 max-md:rounded-lg">
                 <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 max-md:text-4xl">event_repeat</span>
                 <p className="text-outline max-md:text-sm">No recurring subscriptions tracked.</p>
                 <button onClick={() => setSubModal({isOpen: true, data: null})} className="mt-4 text-primary font-bold text-sm">Create One</button>
               </div>
            ) : (
               <>
                 {/* Desktop subscription grid */}
                 <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedSubscriptions.map(sub => (
                       <div 
                         key={sub.id} 
                         className={`bg-surface-container-low rounded-xl p-5 border border-outline/5 hover:border-outline/20 transition-all flex flex-col justify-between h-48 group
                           ${!sub.isActive ? 'opacity-40 grayscale' : ''}
                         `}
                       >
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 className="font-bold text-lg text-on-surface">{sub.name}</h4>
                                <span className="text-[10px] uppercase tracking-wider text-outline">{sub.period}</span>
                             </div>
                             <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={sub.isActive} onChange={() => updateSubscription(sub.id, { isActive: !sub.isActive })} className="sr-only peer" />
                                <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#95CD41]"></div>
                             </label>
                          </div>
                          <div className="flex justify-between items-end">
                             <div>
                                <span className="block text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">
                                   {sub.period === 'one_time' ? 'Expiry Date' : 'Next Renewal'}
                                </span>
                                <span className="font-body text-sm font-medium">
                                   {(() => {
                                      const targetDate = sub.period === 'one_time' ? sub.expiryDate : sub.startDate;
                                      return formatDateToDDMMYYYY(targetDate);
                                   })()}
                                </span>
                             </div>
                             <div className="text-right">
                                <span className="block font-headline font-extrabold text-xl">{formatCurrency(sub.amount)}</span>
                                <button onClick={() => setSubModal({isOpen: true, data: sub})} className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold hover:text-primary transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 justify-end mt-1">
                                   Edit <span className="material-symbols-outlined text-[10px]">edit</span>
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>

                 {/* Mobile subscription list */}
                 <div className="md:hidden flex flex-col gap-2.5">
                    {sortedSubscriptions.map(sub => (
                       <div 
                         key={sub.id} 
                         onClick={() => setSubModal({isOpen: true, data: sub})} 
                         className={`bg-surface-container-low rounded-lg p-4 border border-outline/5 active:border-outline/20 transition-all cursor-pointer
                           ${!sub.isActive ? 'opacity-40 grayscale' : ''}
                         `}
                       >
                          <div className="flex justify-between items-center mb-2">
                             <div className="flex items-center gap-2 min-w-0">
                                <h4 className="font-bold text-sm text-on-surface truncate">{sub.name}</h4>
                                <span className="text-[9px] uppercase tracking-wider text-outline shrink-0 bg-surface-container-highest px-1.5 py-0.5 rounded">{sub.period}</span>
                             </div>
                             <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={sub.isActive} onChange={() => updateSubscription(sub.id, { isActive: !sub.isActive })} className="sr-only peer" />
                                <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#95CD41]"></div>
                             </label>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-xs text-on-surface-variant">
                                <span className="font-bold opacity-70 tracking-wide text-[10px] uppercase mr-1">
                                   {sub.period === 'one_time' ? 'Expires:' : 'Renews:'}
                                </span>
                                {(() => {
                                   const targetDate = sub.period === 'one_time' ? sub.expiryDate : sub.startDate;
                                   return formatDateToDDMMYYYY(targetDate);
                                })()}
                             </span>
                             <span className="font-headline font-extrabold text-base text-on-surface">{formatCurrency(sub.amount)}</span>
                          </div>
                       </div>
                    ))}
                 </div>
               </>
            )}
         </section>
      )}

      {/* ===== BILLS TAB ===== */}
      {activeTab === 'BILLS' && (
         <section className="animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6 max-md:mb-4">
               <h3 className="font-headline font-bold text-xl max-md:text-base">Credit Cards ({creditCards.length})</h3>
               <button onClick={() => setCcModal({isOpen: true, data: null})} className="text-sm font-bold text-error-container flex items-center gap-1 hover:brightness-125 transition-all max-md:text-xs">
                 <span className="material-symbols-outlined text-sm">add</span> Add Card
               </button>
            </div>
            
            {sortedCreditCards.length === 0 ? (
               <div className="text-center py-16 bg-surface-container-low rounded-xl border border-dashed border-outline/20 max-md:py-10 max-md:rounded-lg">
                 <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 max-md:text-4xl">credit_card</span>
                 <p className="text-outline max-md:text-sm">No credit cards tracked.</p>
                 <button onClick={() => setCcModal({isOpen: true, data: null})} className="mt-4 text-error-container font-bold text-sm">Add Card</button>
               </div>
            ) : (
               <div className="flex flex-col gap-4 max-md:gap-2.5">
                  {sortedCreditCards.map(cc => {
                    const warning = isApproaching(cc.billDueDate, 5);
                    const past = isPastDue(cc.billDueDate);
                    
                    return (
                      <React.Fragment key={cc.id}>
                        {/* Desktop credit card row */}
                        <div 
                          className={`hidden md:flex group cursor-pointer bg-surface-container-low rounded-xl p-5 border border-outline/5 hover:border-outline/20 transition-all flex-col md:flex-row md:items-center justify-between gap-6
                            ${past ? 'opacity-40 grayscale' : ''}
                          `}
                          onClick={() => setCcModal({ isOpen: true, data: cc })}
                        >
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-10 bg-gradient-to-br from-[#E5BA73] to-[#67490b] rounded-md shadow-md flex items-center justify-end px-2 opacity-90">
                                <span className="text-[10px] font-bold text-white tracking-widest">{cc.last4Digits}</span>
                             </div>
                             <div>
                                <h4 className="font-bold text-lg text-on-surface">{cc.name}</h4>
                                {cc.notes && <p className="text-xs text-outline">{cc.notes}</p>}
                             </div>
                          </div>
                          <div className="flex items-center gap-10">
                             <div className="text-right">
                                <span className="block text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Bill Due Date</span>
                                <span className={`font-body text-sm font-bold ${(warning || past) ? 'text-error animate-pulse' : 'text-on-surface'}`}>
                                   {formatDateToDDMMYYYY(cc.billDueDate)} {past ? '(Past Due)' : warning ? '(Soon)' : ''}
                                </span>
                             </div>
                             <div className="text-right border-l border-outline/10 pl-6">
                                <span className="block text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Amount Pending</span>
                                <span className="font-headline font-extrabold text-xl text-outline">N/A</span>
                             </div>
                             <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 hidden md:block">edit</span>
                          </div>
                        </div>

                        {/* Mobile credit card row */}
                        <div 
                          className={`md:hidden bg-surface-container-low rounded-lg p-4 border border-outline/5 active:border-outline/20 transition-all cursor-pointer
                            ${past ? 'opacity-40 grayscale' : ''}
                          `}
                          onClick={() => setCcModal({ isOpen: true, data: cc })}
                        >
                          <div className="flex items-center gap-3 mb-3">
                             <div className="w-12 h-8 bg-gradient-to-br from-[#E5BA73] to-[#67490b] rounded-md shadow-sm flex items-center justify-end px-1.5 shrink-0">
                                <span className="text-[9px] font-bold text-white tracking-widest">{cc.last4Digits}</span>
                             </div>
                             <div className="min-w-0">
                                <h4 className="font-bold text-sm text-on-surface truncate">{cc.name}</h4>
                                {cc.notes && <p className="text-[11px] text-outline truncate">{cc.notes}</p>}
                             </div>
                          </div>
                          <div className="flex justify-between items-center">
                             <div>
                                <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">Due Date</span>
                                <span className={`text-xs font-bold ${(warning || past) ? 'text-error' : 'text-on-surface'}`}>
                                   {formatDateToDDMMYYYY(cc.billDueDate)} {past ? '· Past Due' : warning ? '· Soon' : ''}
                                </span>
                             </div>
                             <div className="text-right">
                                <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">Pending</span>
                                <span className="font-headline font-extrabold text-sm text-outline">N/A</span>
                             </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
               </div>
            )}
         </section>
      )}

      <Modal isOpen={subModal.isOpen} onClose={() => setSubModal({ isOpen: false, data: null})} title={subModal.data ? "Edit Subscription" : "Add Subscription"}>
         <AddSubscriptionForm initialData={subModal.data} onClose={() => setSubModal({isOpen: false, data: null})} />
      </Modal>

      <Modal isOpen={ccModal.isOpen} onClose={() => setCcModal({ isOpen: false, data: null})} title={ccModal.data ? "Edit Credit Card" : "Track Credit Card"}>
         <AddCreditCardForm initialData={ccModal.data} onClose={() => setCcModal({isOpen: false, data: null})} />
      </Modal>
    </main>
  );
};

export default CyclicScreen;
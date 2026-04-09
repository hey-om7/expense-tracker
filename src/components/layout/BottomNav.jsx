import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const [showMore, setShowMore] = useState(false);

  const mainItems = [
    { path: '/', icon: 'dashboard', label: 'Home' },
    { path: '/transactions', icon: 'receipt_long', label: 'History' },
    { path: '/investments', icon: 'monitoring', label: 'Invest' },
    { path: '/analytics', icon: 'bar_chart', label: 'Analytics' },
  ];

  const moreItems = [
    { path: '/cyclic', icon: 'autorenew', label: 'Cyclic' },
    { path: '/categories', icon: 'category', label: 'Categories' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <>
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-20 left-4 right-4 bg-surface-container-high border border-outline-variant/20 rounded-2xl p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            {moreItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setShowMore(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(item.path) ? 'bg-[#E5BA73]/10 text-[#E5BA73]' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                <span className="font-inter font-semibold text-sm">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#1A120B]/90 backdrop-blur-2xl z-50 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] flex justify-around items-center px-2 py-3 pb-safe">
        {mainItems.map(item => (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] transition-all active:scale-90 duration-300 ${isActive(item.path) ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73] p-2'}`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
            <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-0.5">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] transition-all active:scale-90 duration-300 ${showMore || moreItems.some(i => isActive(i.path)) ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73] p-2'}`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: showMore ? "'FILL' 1" : "'FILL' 0" }}>more_horiz</span>
          <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#1A120B]/90 backdrop-blur-2xl z-50 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] flex justify-around items-center px-4 py-3 pb-safe">
      <Link to="/" className={`flex flex-col items-center justify-center transition-all active:scale-90 duration-300 ${isActive('/') ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73]'}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
        <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-1">Home</span>
      </Link>
      <Link to="/transactions" className={`flex flex-col items-center justify-center transition-all active:scale-90 duration-300 ${isActive('/transactions') ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73]'}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/transactions') ? "'FILL' 1" : "'FILL' 0" }}>receipt_long</span>
        <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-1">History</span>
      </Link>
      <button className="flex flex-col items-center justify-center text-[#F1DFD3]/40 hover:text-[#E5BA73] transition-all active:scale-90 duration-300">
        <span className="material-symbols-outlined text-4xl -mt-4 text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
      </button>
      <Link to="/investments" className={`flex flex-col items-center justify-center transition-all active:scale-90 duration-300 ${isActive('/investments') ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73]'}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/investments') ? "'FILL' 1" : "'FILL' 0" }}>payments</span>
        <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-1">Wealth</span>
      </Link>
      <Link to="/analytics" className={`flex flex-col items-center justify-center transition-all active:scale-90 duration-300 ${isActive('/analytics') ? 'text-[#E5BA73] bg-[#E5BA73]/10 rounded-full p-2' : 'text-[#F1DFD3]/40 hover:text-[#E5BA73]'}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/analytics') ? "'FILL' 1" : "'FILL' 0" }}>insights</span>
        <span className="font-inter font-medium text-[8px] uppercase tracking-widest mt-1">Trends</span>
      </Link>
    </nav>
  );
};

export default BottomNav;

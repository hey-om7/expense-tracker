import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/transactions', icon: 'receipt_long', label: 'History' },
  { path: '/investments', icon: 'monitoring', label: 'Investments' },
  { path: '/cyclic', icon: 'autorenew', label: 'Cyclic' },
  { path: '/analytics', icon: 'bar_chart', label: 'Analytics' },
  { path: '/categories', icon: 'category', label: 'Categories' },
];

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-surface-container-lowest h-screen fixed left-0 top-0 border-r border-outline/10 hidden md:flex flex-col z-40">
      <div className="p-8">
        <h1 className="text-2xl font-headline font-extrabold tracking-tighter text-on-surface">Wallo</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F1DFD3]/40 mt-1">Premium Wealth Management</p>
      </div>
      <nav className="flex flex-col gap-2 px-4">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive(item.path) ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      
      <div className="mt-auto p-8 mb-8">
        <div className="bg-surface-container-low rounded-xl p-4 border border-outline/5">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">ON</span>
            <div>
              <p className="text-sm font-bold text-on-surface text-ellipsis overflow-hidden">Omar N.</p>
              <p className="text-[10px] text-outline">Pro Plan</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

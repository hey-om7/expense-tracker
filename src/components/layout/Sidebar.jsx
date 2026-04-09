import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/transactions', icon: 'receipt_long', label: 'History' },
  { path: '/investments', icon: 'monitoring', label: 'Investments' },
  { path: '/cyclic', icon: 'autorenew', label: 'Cyclic' },
  { path: '/analytics', icon: 'bar_chart', label: 'Analytics' },
  { path: '/categories', icon: 'category', label: 'Categories' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
      
      <div className="mt-auto px-4 pb-4">
        <div className="bg-surface-container-low rounded-lg p-4 border border-outline/5">
          <div className="flex flex-col items-center text-center mb-3">
            <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm mb-2">
              {user ? getInitials(user.name) : '?'}
            </span>
            <p className="text-sm font-bold text-on-surface w-full break-words">
              {user?.name || 'User'}
            </p>
            <p className="text-[10px] text-outline w-full break-all leading-relaxed mt-0.5">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            id="sidebar-logout-btn"
            className="w-full flex items-center justify-center gap-2 text-xs font-inter font-medium text-on-surface-variant/60 hover:text-error
              bg-surface-container/60 hover:bg-error-container/20 border border-outline-variant/20 hover:border-error/20
              rounded-lg py-2 transition-all duration-200"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

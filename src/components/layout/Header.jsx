import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useAppContext();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-[#1A120B]/80 backdrop-blur-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">
      <div className="flex justify-between md:justify-end items-center px-6 h-16 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-3 md:hidden">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden">
            <span className="text-on-primary font-bold text-xs uppercase">
              {user ? getInitials(user.name) : 'W'}
            </span>
          </div>
          <h1 className="font-manrope font-bold text-lg tracking-tight text-[#E5BA73]">Wallo</h1>
        </div>
        <div className="flex items-center gap-2 relative">
          {/* Notifications */}
          <button
            onClick={() => { setShowDropdown(!showDropdown); setShowUserMenu(false); }}
            className="p-2 relative text-[#F1DFD3]/60 hover:bg-[#E5BA73]/10 transition-colors rounded-full active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-error rounded-full border-2 border-background"></span>
            )}
          </button>

          {/* Mobile user menu button */}
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowDropdown(false); }}
            className="md:hidden p-2 text-[#F1DFD3]/60 hover:bg-[#E5BA73]/10 transition-colors rounded-full active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined">person</span>
          </button>

          {/* Notifications dropdown */}
          {showDropdown && (
            <div className="absolute top-12 right-0 w-80 bg-surface-container-high border border-outline/20 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center px-5 py-4 border-b border-outline/10 bg-surface-container-high">
                <h3 className="font-bold">Notifications</h3>
                <div className="flex gap-2">
                  <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">Read All</button>
                  <button onClick={clearNotifications} className="text-xs text-on-surface-variant hover:text-error hover:underline">Clear</button>
                </div>
              </div>
              <div className="max-h-[340px] overflow-y-auto flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                {notifications.length === 0 ? (
                  <p className="text-sm p-4 text-center text-outline">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-outline/10 cursor-pointer hover:bg-surface-container-highest transition-colors ${!n.isRead ? 'bg-surface-container-lowest' : ''}`}>
                      <h4 className={`text-sm font-bold ${!n.isRead ? 'text-on-surface' : 'text-on-surface-variant'}`}>{n.title}</h4>
                      <p className="text-xs text-outline">{n.message}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">{new Date(n.date).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mobile user menu dropdown */}
          {showUserMenu && (
            <div className="absolute top-12 right-0 w-56 bg-surface-container-high border border-outline/20 rounded-lg shadow-2xl z-50 overflow-hidden md:hidden">
              <div className="px-4 py-3 border-b border-outline/10">
                <p className="text-sm font-bold text-on-surface">{user?.name || 'User'}</p>
                <p className="text-[10px] text-outline">{user?.email || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                id="mobile-logout-btn"
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-inter text-on-surface-variant hover:text-error hover:bg-error-container/10 transition-all"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <aside className="hidden md:flex flex-col p-6 gap-4 h-full w-72 fixed left-0 top-0 bg-[#1A120B] shadow-2xl z-50">
      <div className="mb-8 px-4 mt-16 md:mt-0">
        <h2 className="font-manrope font-black text-xl text-[#E5BA73] tracking-tighter">Wallo</h2>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F1DFD3]/40 mt-1">Premium Wealth Management</p>
      </div>
      <nav className="flex flex-col gap-2">
        <Link to="/" className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive('/') ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
          Dashboard
        </Link>
        <Link to="/transactions" className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive('/transactions') ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/transactions') ? "'FILL' 1" : "'FILL' 0" }}>receipt_long</span>
          Transactions
        </Link>
        <Link to="/investments" className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive('/investments') ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/investments') ? "'FILL' 1" : "'FILL' 0" }}>payments</span>
          Investments
        </Link>
        <Link to="/analytics" className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive('/analytics') ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/analytics') ? "'FILL' 1" : "'FILL' 0" }}>insights</span>
          Analytics
        </Link>
        <Link to="/categories" className={`flex items-center gap-4 px-4 py-3 font-manrope font-semibold text-sm transition-all rounded-lg ${isActive('/categories') ? 'bg-[#E5BA73]/10 text-[#E5BA73] border-l-4 border-[#E5BA73] translate-x-1' : 'text-[#F1DFD3]/50 hover:bg-[#E5BA73]/5 hover:text-[#E5BA73]'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/categories') ? "'FILL' 1" : "'FILL' 0" }}>category</span>
          Categories
        </Link>
      </nav>
      <div className="mt-auto p-4 bg-[#241a12] rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden">
            <img alt="User avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBF85blHah5x2TCecZTnzRI1EUMMO6uIBOB9ULl0DBP0L7LJ_dDUqrJfZyLZfouKyJdcYhy_KeCEZn3tSOuqHSh0cUDeRBOemAszabwQkkTp4CXgl3170I7JtW4l2r3cyOeNW_6RJFEwheEdx2witnQxD8s2k8Xp4LItxutXnM8uy8NIYkW0wb36YvLF-ux3gUruDiGZK37Q1MJ5xhhHmvzJwf8sj8Vsle0n29-3OKYnkxrv2dxs_pbB84IcLsZAkj03sHsAVFX0Co" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#E5BA73]">Julian V.</p>
            <p className="text-xs text-[#F1DFD3]/40">Elite Member</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';

const Header = () => (
  <header className="fixed top-0 right-0 left-0 md:left-72 z-50 bg-[#1A120B]/80 backdrop-blur-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">
    <div className="flex justify-between items-center px-6 h-16 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden">
          <img alt="User profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdc6PogVEWwO8XAseKguONzvIuqNykTMICHBkkBZ_5oSw5DoOpRh4O9RUaBIhieZoqOic7xwPRmSpwAvk3sN0UDQuMapJxf-a4N-WSzo0x1IVhhORxZfsUgTZxr6R-MYBp-Gdm4gGzcVKCq94HXN0lqaZjMq3sD9altVRWZ9Q8mv0oHMD14A4_FrTDOYpw8P3ANUFvIePR38ZAFxJuvapAscOx2Gn5SHe8tVXFejGA2Qr-PXkw5qClsFZBuQ8YK3GbmdzSIAsCE8o" />
        </div>
        <h1 className="font-manrope font-bold text-lg tracking-tight text-[#E5BA73]">Espresso Reserve</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 text-[#F1DFD3]/60 hover:bg-[#E5BA73]/10 transition-colors rounded-full active:scale-95 duration-200">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </div>
    </div>
  </header>
);

export default Header;

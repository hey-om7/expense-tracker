import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AiChatbot from '../ui/AiChatbot';

const Layout = ({ children }) => {
  return (
    <div className="pb-24 md:pb-0 md:pl-72">
      <Header />
      <Sidebar />
      {children}
      <BottomNav />
      <AiChatbot />
    </div>
  );
};

export default Layout;

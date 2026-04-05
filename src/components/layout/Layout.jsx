import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  return (
    <>
      <Header />
      <Sidebar />
      {children}
      <BottomNav />
    </>
  );
};

export default Layout;

// Auto-generado por PyZero Generator
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="app-layout">
      <Navbar />
      <div className="page-content">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

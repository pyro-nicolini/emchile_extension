// Auto-generado por PyZero Generator
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`navbar${scrolled ? ' navbar--scrolled' : ''}${true && !scrolled ? ' navbar--transparent' : ''}`}>
      <div className="container navbar__inner">
        <Link to="/" className="navbar__brand">
          
          <span className="navbar__brand-name">Mi Restaurante</span>
        </Link>

        <nav className={`navbar__nav${menuOpen ? ' navbar__nav--open' : ''}`} aria-label="Navegación principal">
          <ul className="navbar__list">
          <li><a href="/" className="nav-link">Inicio</a></li>
          <li><a href="/menu" className="nav-link">Menú</a></li>
          <li><a href="/galery" className="nav-link">Reservas</a></li>
          </ul>
        </nav>

        <a href="/reservas" className="btn btn--primary navbar__cta">Reservar Mesa</a>

        {user ? (
          <div className="navbar__auth-menu" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
            <Link to="/dashboard" className="btn btn--outline">Dashboard</Link>
            <button onClick={logout} className="btn btn--primary">Salir</button>
          </div>
        ) : (
          <div className="navbar__auth-menu" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
            <Link to="/login" className="btn btn--primary">Login</Link>
          </div>
        )}

        <button
          className="navbar__hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}

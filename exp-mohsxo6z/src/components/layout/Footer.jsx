// Auto-generado por PyZero Generator
import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Link to="/" className="footer__logo">Mi Restaurante</Link>
          <p className="footer__tagline">Bienvenidos</p>
        </div>
        <nav className="footer__nav" aria-label="Navegación del footer">
          <a href="/" className="footer__link">Inicio</a>
          <a href="/menu" className="footer__link">Menú</a>
          <a href="/galery" className="footer__link">Reservas</a>
        </nav>
      </div>
      <div className="footer__bottom">
        <div className="container">
          <p>© {currentYear} Mi Restaurante. Todos los derechos reservados.</p>
          <p className="footer__credit">Desarrollado por <a href="#" className="footer__link">PyZero Agency</a></p>
        </div>
      </div>
    </footer>
  );
}

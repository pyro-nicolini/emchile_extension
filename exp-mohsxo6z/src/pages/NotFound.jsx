import React from 'react';
import { Link } from 'react-router-dom';
export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>404</h1>
      <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Página no encontrada</h2>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px' }}>
        Lo sentimos, la página que buscas no existe o fue movida.
      </p>
      <Link to="/" className="btn btn--primary">Volver al Inicio</Link>
    </div>
  );
}

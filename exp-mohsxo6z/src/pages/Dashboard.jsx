// Auto-generado por PyZero Generator — Dashboard
import React from 'react';
import { useAuth } from '../context/AuthContext';

const STAT_CARDS = [
  { label: 'Clientes', value: '—', icon: '👥', color: 'var(--color-primary)' },
  { label: 'Servicios', value: '—', icon: '⚙️', color: 'var(--color-accent)' },
  { label: 'Este mes', value: '—', icon: '📈', color: '#16a34a' },
  { label: 'Pendientes', value: '—', icon: '⏳', color: '#ea580c' },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-alt)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', background: 'var(--color-secondary)', color: '#fff', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flexShrink: 0, minHeight: '100vh' }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--text-xl)', paddingBottom: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          ⚡ Panel Principal
        </div>
        {[
          { icon: '🏠', label: 'Inicio', href: '/' },
          { icon: '📊', label: 'Dashboard', href: '/dashboard' },
          { icon: '👥', label: 'Clientes', href: '/dashboard/clients' },
          { icon: '📋', label: 'Servicios', href: '/dashboard/services' },
          { icon: '📅', label: 'Reservas', href: '/dashboard/bookings' },
          { icon: '💳', label: 'Pagos', href: '/dashboard/payments' },
          { icon: '⚙️', label: 'Configuración', href: '/dashboard/settings' },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', transition: 'all 0.2s', fontSize: 'var(--text-sm)' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <span>{item.icon}</span> {item.label}
          </a>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 'var(--space-3)' }}>{user?.name}</p>
          <button onClick={logout} className="btn btn--outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', width: '100%', justifyContent: 'center', fontSize: 'var(--text-sm)' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 'var(--space-10)', overflow: 'auto' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
          Hola, {user?.name || 'Usuario'} 👋
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-10)' }}>
          Resumen del día — {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-10)' }}>
          {STAT_CARDS.map((card, i) => (
            <div key={i} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-md)', borderLeft: `4px solid ${card.color}` }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>{card.icon}</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Placeholder content */}
        <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-10)', boxShadow: 'var(--shadow-md)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-5xl)', marginBottom: 'var(--space-4)' }}>🚧</p>
          <h2>Panel en construcción</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>Las secciones del dashboard se configuran según los módulos activados en el SiteConfig.</p>
        </div>
      </main>
    </div>
  );
}

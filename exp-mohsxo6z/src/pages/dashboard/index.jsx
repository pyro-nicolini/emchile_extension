import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardIndex() {
  const { user } = useAuth();
  return (
    <div>
      <h1 style={{ color: '#0f172a', marginBottom: '8px' }}>Bienvenido, {user?.name || 'Admin'}</h1>
      <p style={{ color: '#64748b' }}>Selecciona un módulo en el menú lateral para comenzar a administrar.</p>
    </div>
  );
}

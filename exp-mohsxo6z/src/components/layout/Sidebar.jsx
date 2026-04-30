import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{ width: '260px', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>PyZero Admin</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{user?.email}</p>
      </div>
      <nav style={{ flex: 1, padding: '20px 12px' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
${sidebarLinks}
        </ul>
      </nav>
      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', background: 'transparent', border: 'none', color: '#ef4444', padding: '10px', cursor: 'pointer', borderRadius: '8px', textAlign: 'left' }}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

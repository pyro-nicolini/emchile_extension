// Auto-generado por PyZero Generator
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-alt)', padding: 'var(--space-6)' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-12)', boxShadow: 'var(--shadow-2xl)', width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Iniciar Sesión</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Mi Restaurante</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" required value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="tu@email.com" autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Contraseña</label>
            <input id="login-password" type="password" required value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="••••••••" autoComplete="current-password" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          ¿No tenés cuenta? <Link to="/register">Registrarse</Link>
        </p>
      </div>
    </div>
  );
}

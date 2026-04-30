// Auto-generado por PyZero Generator
import React, { useState } from 'react';
import './sections.css';
import api from '../../services/api';

export default function ContactSection({ id, props = {}, style = {} }) {
  const { title = 'Contacto', subtitle = '', email, phone, address, hours } = props;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setStatus('loading');
      await api.post('/contact', form);
      setStatus('success');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id={id} className="section contact-section" style={{ backgroundColor: style.backgroundColor, color: style.textColor }}>
      <div className="container contact-inner">
        <div className="contact-info">
          {title && <h2 className="contact-title">{title}</h2>}
          {subtitle && <p className="contact-subtitle">{subtitle}</p>}
          {email && <p className="contact-detail"><strong>Email:</strong> <a href={`mailto:${email}`}>{email}</a></p>}
          {phone && <p className="contact-detail"><strong>Teléfono:</strong> <a href={`tel:${phone}`}>{phone}</a></p>}
          {address && <p className="contact-detail"><strong>Dirección:</strong> {address}</p>}
          {hours && <p className="contact-detail"><strong>Horario:</strong> {hours}</p>}
        </div>
        <form onSubmit={handleSubmit} className="contact-form" noValidate>
          <div className="form-group">
            <label htmlFor="contact-name">Nombre *</label>
            <input id="contact-name" type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Tu nombre completo" />
          </div>
          <div className="form-group">
            <label htmlFor="contact-email">Email *</label>
            <input id="contact-email" type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="tu@email.com" />
          </div>
          <div className="form-group">
            <label htmlFor="contact-phone">Teléfono</label>
            <input id="contact-phone" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+54 11 ..." />
          </div>
          <div className="form-group">
            <label htmlFor="contact-message">Mensaje *</label>
            <textarea id="contact-message" required rows={5} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="¿En qué podemos ayudarte?" />
          </div>
          {status === 'success' && <p className="form-success">✓ ¡Mensaje enviado! Te responderemos pronto.</p>}
          {status === 'error' && <p className="form-error">✕ Error al enviar. Por favor intentá de nuevo.</p>}
          <button type="submit" className="btn btn--primary" disabled={status === 'loading'}>
            {status === 'loading' ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
        </form>
      </div>
    </section>
  );
}

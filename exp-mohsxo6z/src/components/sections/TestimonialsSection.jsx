// Auto-generado por PyZero Generator
import React from 'react';
import './sections.css';

export default function TestimonialsSection({ id, props = {}, style = {} }) {
  const { title = 'Testimonios', items = [] } = props;
  return (
    <section id={id} className="section testimonials-section" style={{ backgroundColor: style.backgroundColor }}>
      <div className="container">
        {title && <h2 className="section-title">{title}</h2>}
        <div className="testimonials-grid">
          {items.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-rating">{'★'.repeat(t.rating || 5)}</div>
              <p className="testimonial-text">"{t.text}"</p>
              <footer className="testimonial-author">
                <strong>{t.name}</strong>
                {t.company && <span> — {t.company}</span>}
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

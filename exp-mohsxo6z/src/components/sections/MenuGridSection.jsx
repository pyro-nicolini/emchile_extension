import React, { useState } from 'react';
export default function MenuGridSection({ id, props = {}, style = {} }) {
  const { title = 'Nuestra Carta', subtitle = '', categories = [], ctaLabel, ctaHref } = props;
  const [activeTab, setActiveTab] = useState(0);
  const current = categories[activeTab] || {};
  return (
    <section id={id} className="section menu-section" style={{ backgroundColor: style.backgroundColor }}>
      <div className="container">
        {title && <h2 className="section-title">{title}</h2>}
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
        <div className="menu-tabs">
          {categories.map((cat, i) => (
            <button key={i} className={`menu-tab${activeTab === i ? ' menu-tab--active' : ''}`} onClick={() => setActiveTab(i)}>
              {cat.name}
            </button>
          ))}
        </div>
        <div className="menu-items">
          {(current.items || []).map((item, i) => (
            <div key={i} className="menu-item">
              <div className="menu-item__info">
                <h4 className="menu-item__name">{item.name}</h4>
                {item.description && <p className="menu-item__desc">{item.description}</p>}
              </div>
              {item.price && <span className="menu-item__price">${item.price}</span>}
            </div>
          ))}
          {(!current.items || current.items.length === 0) && (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-12)' }}>
              Los items del menú se cargan desde el panel de administración.
            </p>
          )}
        </div>
        {ctaLabel && <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}><a href={ctaHref || '#menu'} className="btn btn--primary">{ctaLabel}</a></div>}
      </div>
    </section>
  );
}
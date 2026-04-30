// Auto-generado por PyZero Generator
import React from 'react';
import './sections.css';

export default function StatsSection({ id, props = {}, style = {} }) {
  const { items = [] } = props;
  return (
    <section id={id} className="stats-section" style={{ backgroundColor: style.backgroundColor || 'var(--color-secondary)', color: style.textColor || '#fff', padding: 'var(--space-16) 0' }}>
      <div className="container stats-grid">
        {items.map((stat, i) => (
          <div key={i} className="stat-item">
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

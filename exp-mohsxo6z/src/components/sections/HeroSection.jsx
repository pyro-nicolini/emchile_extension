// Auto-generado por PyZero Generator
import React, { useRef, useEffect, useState } from 'react';
import './sections.css';

export default function HeroSection({ id, props = {}, style = {} }) {
  const {
    title = 'Tu Negocio',
    subtitle = 'Subtítulo descriptivo de tu propuesta de valor',
    overlay = 0.5,
    ctaPrimary,
    ctaSecondary,
    hasGradient = false,
    gradientFrom,
    gradientTo,
    parallax = true,
  } = props;

  const bgImg = style.backgroundImage || props.backgroundImage;
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!parallax || !bgImg) return;
    const handleScroll = () => setOffsetY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [parallax, bgImg]);

  const sectionStyle = {
    position: 'relative',
    paddingTop: style.paddingTop ?? 'var(--space-32)',
    paddingBottom: style.paddingBottom ?? 'var(--space-32)',
    backgroundColor: style.backgroundColor || (hasGradient ? gradientFrom : '#0f172a'),
    color: style.textColor || '#fff',
    overflow: 'hidden',
    ...(bgImg && {
      backgroundImage: bgImg.startsWith('url') ? bgImg : `url('${bgImg}')`,
      backgroundSize: 'cover',
      backgroundPosition: parallax ? 'center ' + offsetY * 0.4 + 'px' : 'center',
      backgroundAttachment: parallax ? 'fixed' : 'scroll',
    }),
    ...(hasGradient && !bgImg && {
      background: `linear-gradient(135deg, ${gradientFrom || 'var(--color-primary)'} 0%, ${gradientTo || 'var(--color-secondary)'} 100%)`,
    }),
  };

  return (
    <section id={id} className="hero-section" style={sectionStyle}>
      {bgImg && (
        <div className="hero-overlay" style={{ background: `rgba(0,0,0,${overlay})` }} />
      )}
      <div className="container hero-section__content">
        <h1 className="hero-section__title animate-fadeInUp">{title}</h1>
        {subtitle && <p className="hero-section__subtitle animate-fadeInUp">{subtitle}</p>}
        {(ctaPrimary || ctaSecondary) && (
          <div className="hero-section__actions animate-fadeInUp">
            {ctaPrimary && (
              <a href={ctaPrimary.href} className="btn btn--primary btn--lg">
                {ctaPrimary.label}
              </a>
            )}
            {ctaSecondary && (
              <a href={ctaSecondary.href} className="btn btn--outline btn--lg" style={{ borderColor: '#fff', color: '#fff' }}>
                {ctaSecondary.label}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
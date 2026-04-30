import React, { useState } from 'react';
export default function GallerySection({ id, props = {}, style = {} }) {
  const { title = 'Galería', images = [], columns = 3 } = props;
  const [lightbox, setLightbox] = useState(null);
  return (
    <section id={id} className="section gallery-section" style={{ backgroundColor: style.backgroundColor }}>
      <div className="container">
        {title && <h2 className="section-title">{title}</h2>}
        <div className="gallery-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {images.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="gallery-item gallery-item--placeholder">
                  <span>Imagen {i + 1}</span>
                </div>
              ))
            : images.map((img, i) => (
                <button key={i} className="gallery-item" onClick={() => setLightbox(img)}>
                  <img src={typeof img === 'string' ? img : img.src} alt={img.alt || `Imagen ${i+1}`} loading="lazy" />
                </button>
              ))}
        </div>
        {lightbox && (
          <div className="lightbox" onClick={() => setLightbox(null)}>
            <img src={typeof lightbox === 'string' ? lightbox : lightbox.src} alt="" />
          </div>
        )}
      </div>
    </section>
  );
}
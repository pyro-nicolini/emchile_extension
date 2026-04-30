import React from 'react';
export default function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
      <div style={{
        width: '40px', height: '40px',
        border: '4px solid var(--color-bg-alt)',
        borderTop: '4px solid var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{' @keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

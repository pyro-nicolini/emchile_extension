import React from 'react';
import { Edit, Trash } from 'lucide-react';

export default function Table({ columns, data, onEdit, onDelete }) {
  if (!data?.length) return <div style={{ padding: '2rem', textAlign: 'center' }}>No hay datos disponibles.</div>;
  
  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>{col.label}</th>
            ))}
            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {columns.map((col, j) => (
                <td key={j} style={{ padding: '12px 16px', color: '#334155' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                </td>
              ))}
              <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit && onEdit(row)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit size={18} /></button>
                <button onClick={() => onDelete && onDelete(row)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash size={18} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

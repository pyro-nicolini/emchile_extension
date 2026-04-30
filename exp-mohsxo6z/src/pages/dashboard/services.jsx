import React, { useEffect, useState } from 'react';
import { useServices } from '../../context/ServicesContext';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import useForm from '../../hooks/useForm';

export default function ServicesPage() {
  const { data, loading, error, fetchAll, create, update, remove } = useServices();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const { values, handleChange, reset, setValues } = useForm({
    title: '', description: ''
  });

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) setValues(item);
    else reset();
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) await update(editingItem.id, values);
      else await create(values);
      setModalOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (item) => {
    if (window.confirm('¿Seguro que deseas eliminar esto?')) {
      await remove(item.id);
    }
  };

  // Dinámicamente inferimos columnas del primer registro, o fallbacks
  const generateColumns = () => {
    if (!data || data.length === 0) return [{ key: 'id', label: 'ID' }];
    const firstObj = data[0];
    return Object.keys(firstObj)
      .filter(k => k !== 'createdAt' && k !== 'updatedAt')
      .slice(0, 4) // Show max 4 columns
      .map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#0f172a', margin: 0 }}>Gestión de Services</h1>
        <button 
          onClick={() => handleOpenModal()} 
          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          Añadir Nuevo
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}
      
      {loading ? (
        <div>Cargando datos...</div>
      ) : (
        <Table columns={generateColumns()} data={data} onEdit={handleOpenModal} onDelete={handleDelete} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Editar Services' : 'Nuevo Services'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Formulario genérico, requiere personalización manual */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Título / Nombre</label>
            <input 
              name="title" 
              value={values.title || values.name || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
            />
          </div>
          <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginTop: '10px' }}>
            Guardar
          </button>
        </form>
      </Modal>
    </div>
  );
}

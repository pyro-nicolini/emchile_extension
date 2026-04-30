import React, { createContext, useContext, useState, useCallback } from 'react';
import { ServicesService } from '../services/services.service';

const ServicesContext = createContext(null);

export function ServicesProvider({ children }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ServicesService.getAll();
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.error || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = async (payload) => {
    try {
      const res = await ServicesService.create(payload);
      setData(prev => [...prev, res.data]);
      return res.data;
    } catch (err) {
      throw new Error(err.error || 'Error al crear');
    }
  };

  const update = async (id, payload) => {
    try {
      const res = await ServicesService.update(id, payload);
      setData(prev => prev.map(item => item.id === id ? res.data : item));
      return res.data;
    } catch (err) {
      throw new Error(err.error || 'Error al actualizar');
    }
  };

  const remove = async (id) => {
    try {
      await ServicesService.delete(id);
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      throw new Error(err.error || 'Error al eliminar');
    }
  };

  return (
    <ServicesContext.Provider value={{ data, loading, error, fetchAll, create, update, remove }}>
      {children}
    </ServicesContext.Provider>
  );
}

export const useServices = () => useContext(ServicesContext);

import { useState } from 'react';
export default function useForm(initialState = {}) {
  const [values, setValues] = useState(initialState);
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  const reset = () => setValues(initialState);
  return { values, handleChange, reset, setValues };
}

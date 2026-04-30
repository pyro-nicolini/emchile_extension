// Auto-generado por PyZero Generator
import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <AppContext.Provider value={{ loading, setLoading, notification, notify }}>
      {children}
      {notification && (
        <div className={`toast toast--${notification.type}`} role="alert">
          {notification.message}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// Auto-generado por PyZero Generator
import React from 'react';
import AppRouter from './router';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ServicesProvider } from './context/ServicesContext';
import { BookingsProvider } from './context/BookingsContext';
import { PaymentsProvider } from './context/PaymentsContext';
import { ExpensesProvider } from './context/ExpensesContext';
import { ClientsProvider } from './context/ClientsContext';
import { QuotationsProvider } from './context/QuotationsContext';


export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
      <ServicesProvider>
      <BookingsProvider>
      <PaymentsProvider>
      <ExpensesProvider>
      <ClientsProvider>
      <QuotationsProvider>
      <AppRouter />
      </QuotationsProvider>
      </ClientsProvider>
      </ExpensesProvider>
      </PaymentsProvider>
      </BookingsProvider>
      </ServicesProvider>
      </AuthProvider>
    </AppProvider>
  );
}

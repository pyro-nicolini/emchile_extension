// Auto-generado por PyZero Generator — Modo: fullstack
import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import NotFound from '../pages/NotFound';
import LoadingSpinner from '../components/LoadingSpinner';
import ProtectedRoute from '../components/layout/ProtectedRoute';

// Lazy loading de páginas (mejor performance)
const InicioPage = React.lazy(() => import('../pages/Inicio'));
const MenúPage = React.lazy(() => import('../pages/Menú'));
const GaleriaPage = React.lazy(() => import('../pages/Galeria'));

const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const DashboardIndex = React.lazy(() => import('../pages/dashboard/index'));
const ServicesDashboard = React.lazy(() => import('../pages/dashboard/services'));
const BookingsDashboard = React.lazy(() => import('../pages/dashboard/bookings'));
const PaymentsDashboard = React.lazy(() => import('../pages/dashboard/payments'));
const ExpensesDashboard = React.lazy(() => import('../pages/dashboard/expenses'));
const ClientsDashboard = React.lazy(() => import('../pages/dashboard/clients'));
const QuotationsDashboard = React.lazy(() => import('../pages/dashboard/quotations'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { path: '/', element: <InicioPage /> },
      { path: '/menu', element: <MenúPage /> },
      { path: '/galery', element: <GaleriaPage /> },
      { 
        path: '/dashboard', 
        element: <DashboardLayout />, 
        children: [
            { index: true, element: <DashboardIndex /> },
            { path: 'services', element: <ServicesDashboard /> },
            { path: 'bookings', element: <BookingsDashboard /> },
            { path: 'payments', element: <PaymentsDashboard /> },
            { path: 'expenses', element: <ExpensesDashboard /> },
            { path: 'clients', element: <ClientsDashboard /> },
            { path: 'quotations', element: <QuotationsDashboard /> },
        ]
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

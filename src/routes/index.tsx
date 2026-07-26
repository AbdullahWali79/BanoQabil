import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { PendingApprovalPage } from '@/features/auth/pages/PendingApprovalPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

// Simple placeholder components for now
const Dashboard = () => <div className="p-8"><h1>Dashboard (Protected & Approved)</h1></div>;
const Unauthorized = () => <div className="p-8 text-center text-red-500"><h1>403 - Unauthorized</h1></div>;

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/pending",
    element: (
      <ProtectedRoute>
        <PendingApprovalPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/unauthorized",
    element: <Unauthorized />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}

import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { PendingApprovalPage } from '@/features/auth/pages/PendingApprovalPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';

// Simple placeholder components for now
const Dashboard = () => <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-muted-foreground mt-2">Welcome back to your portal.</p></div>;
const Approvals = () => <div><h1 className="text-3xl font-bold">Pending Approvals</h1><p className="text-muted-foreground mt-2">Manage user registrations here.</p></div>;
const Unauthorized = () => <div className="p-8 text-center text-destructive"><h1>403 - Unauthorized</h1></div>;

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
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
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "approvals",
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <Approvals />
          </ProtectedRoute>
        )
      }
    ]
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

import { createBrowserRouter, RouterProvider } from 'react-router';

// Simple placeholder components for now
const Dashboard = () => <div className="p-8"><h1>Dashboard</h1></div>;
const Login = () => <div className="p-8"><h1>Login</h1></div>;

const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
  },
  {
    path: "/login",
    element: <Login />,
  }
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}

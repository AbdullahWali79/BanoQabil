import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { PendingApprovalPage } from '@/features/auth/pages/PendingApprovalPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';

// Admin Pages
import { PendingApprovalsPage } from '@/features/admin/pages/PendingApprovalsPage';
import AdminDashboard from '@/features/admin/pages/AdminDashboard';
import ManageTeachersPage from '@/features/admin/pages/ManageTeachersPage';
import ManageStudentsPage from '@/features/admin/pages/ManageStudentsPage';
import CoursesPage from '@/features/admin/pages/CoursesPage';
import ReportsPage from '@/features/admin/pages/ReportsPage';
import AllSubmissionsPage from '@/features/admin/pages/AllSubmissionsPage';
import AllAssignmentsPage from '@/features/admin/pages/AllAssignmentsPage';

// Teacher Pages
import TeacherDashboard from '@/features/teacher/pages/TeacherDashboard';
import MyClassPage from '@/features/teacher/pages/MyClassPage';
import TeacherAssignmentsPage from '@/features/teacher/pages/TeacherAssignmentsPage';
import GradeSubmissionsPage from '@/features/teacher/pages/GradeSubmissionsPage';
import StudentProgressPage from '@/features/teacher/pages/StudentProgressPage';

// Student Pages
import StudentDashboard from '@/features/student/pages/StudentDashboard';
import StudentAssignmentsPage from '@/features/student/pages/StudentAssignmentsPage';
import MyGradesPage from '@/features/student/pages/MyGradesPage';
import StudentSetupPage from '@/features/student/pages/StudentSetupPage';

// Shared Pages
import SettingsPage from '@/features/shared/pages/SettingsPage';
import ManageAdminsPage from '@/features/superadmin/pages/ManageAdminsPage';

// Role-aware Dashboard component
import { useAuthStore } from '@/store/authStore';

function RoleDashboard() {
  const { role } = useAuthStore();
  if (role === 'Super Admin' || role === 'Admin') return <AdminDashboard />;
  if (role === 'Teacher') return <TeacherDashboard />;
  if (role === 'Student') return <StudentDashboard />;
  return <div className="p-8"><h1 className="text-2xl font-bold">Welcome to BanoQabil</h1></div>;
}

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
    <h1 className="text-4xl font-bold text-destructive">403</h1>
    <p className="text-muted-foreground">You are not authorized to view this page.</p>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/pending',
    element: (
      <ProtectedRoute>
        <PendingApprovalPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      // Default dashboard (role-aware)
      { index: true, element: <RoleDashboard /> },

      // ─── Admin & Super Admin Routes ───────────────────────────────────────
      {
        path: 'approvals',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <PendingApprovalsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'teachers',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <ManageTeachersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'students',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <ManageStudentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'courses',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <CoursesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'all-submissions',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <AllSubmissionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'all-assignments',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Admin']}>
            <AllAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admins',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin']}>
            <ManageAdminsPage />
          </ProtectedRoute>
        ),
      },

      // ─── Teacher Routes ───────────────────────────────────────────────────
      {
        path: 'my-class',
        element: (
          <ProtectedRoute allowedRoles={['Teacher']}>
            <MyClassPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assignments',
        element: (
          <ProtectedRoute allowedRoles={['Teacher']}>
            <TeacherAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assignments/:assignmentId/grade',
        element: (
          <ProtectedRoute allowedRoles={['Teacher']}>
            <GradeSubmissionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'progress',
        element: (
          <ProtectedRoute allowedRoles={['Teacher']}>
            <StudentProgressPage />
          </ProtectedRoute>
        ),
      },

      // ─── Student Routes ───────────────────────────────────────────────────
      {
        path: 'my-assignments',
        element: (
          <ProtectedRoute allowedRoles={['Student']}>
            <StudentAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-grades',
        element: (
          <ProtectedRoute allowedRoles={['Student']}>
            <MyGradesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'setup',
        element: (
          <ProtectedRoute allowedRoles={['Student']}>
            <StudentSetupPage />
          </ProtectedRoute>
        ),
      },

      // ─── Shared Routes ─────────────────────────────────────────────────────
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '/unauthorized',
    element: <Unauthorized />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}

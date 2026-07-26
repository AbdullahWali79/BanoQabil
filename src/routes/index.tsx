import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { PendingApprovalPage } from '@/features/auth/pages/PendingApprovalPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { PendingApprovalsPage } from '@/features/admin/pages/PendingApprovalsPage';
import { useAuthStore } from '@/store/authStore';

// Lazy load all heavy pages to avoid a single bad import crashing the whole app
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const ManageTeachersPage = lazy(() => import('@/features/admin/pages/ManageTeachersPage'));
const ManageStudentsPage = lazy(() => import('@/features/admin/pages/ManageStudentsPage'));
const CoursesPage = lazy(() => import('@/features/admin/pages/CoursesPage'));
const ReportsPage = lazy(() => import('@/features/admin/pages/ReportsPage'));
const AllSubmissionsPage = lazy(() => import('@/features/admin/pages/AllSubmissionsPage'));
const AllAssignmentsPage = lazy(() => import('@/features/admin/pages/AllAssignmentsPage'));
const ManageAdminsPage = lazy(() => import('@/features/superadmin/pages/ManageAdminsPage'));

const TeacherDashboard = lazy(() => import('@/features/teacher/pages/TeacherDashboard'));
const MyClassPage = lazy(() => import('@/features/teacher/pages/MyClassPage'));
const TeacherAssignmentsPage = lazy(() => import('@/features/teacher/pages/TeacherAssignmentsPage'));
const GradeSubmissionsPage = lazy(() => import('@/features/teacher/pages/GradeSubmissionsPage'));
const StudentProgressPage = lazy(() => import('@/features/teacher/pages/StudentProgressPage'));

const StudentDashboard = lazy(() => import('@/features/student/pages/StudentDashboard'));
const StudentAssignmentsPage = lazy(() => import('@/features/student/pages/StudentAssignmentsPage'));
const MyGradesPage = lazy(() => import('@/features/student/pages/MyGradesPage'));
const StudentSetupPage = lazy(() => import('@/features/student/pages/StudentSetupPage'));

const SettingsPage = lazy(() => import('@/features/shared/pages/SettingsPage'));

// Loading spinner shown while lazy components load
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
    </div>
  );
}

// Role-aware Dashboard
function RoleDashboard() {
  const { role } = useAuthStore();
  return (
    <Suspense fallback={<PageLoader />}>
      {(role === 'Super Admin' || role === 'Admin') && <AdminDashboard />}
      {role === 'Teacher' && <TeacherDashboard />}
      {role === 'Student' && <StudentDashboard />}
      {!role && (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold">Welcome to BanoQabil</h1>
          <p className="text-muted-foreground mt-2">Loading your dashboard...</p>
        </div>
      )}
    </Suspense>
  );
}

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
    <h1 className="text-4xl font-bold text-destructive">403</h1>
    <p className="text-muted-foreground">You are not authorized to view this page.</p>
  </div>
);

// Helper to wrap lazy pages with Suspense
function Lazy({ children }: { children: import('react').ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/pending',
    element: <ProtectedRoute><PendingApprovalPage /></ProtectedRoute>,
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <RoleDashboard /> },

      // Admin & Super Admin
      { path: 'approvals', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><PendingApprovalsPage /></ProtectedRoute> },
      { path: 'teachers', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><ManageTeachersPage /></Lazy></ProtectedRoute> },
      { path: 'students', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><ManageStudentsPage /></Lazy></ProtectedRoute> },
      { path: 'courses', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><CoursesPage /></Lazy></ProtectedRoute> },
      { path: 'reports', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><ReportsPage /></Lazy></ProtectedRoute> },
      { path: 'all-submissions', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><AllSubmissionsPage /></Lazy></ProtectedRoute> },
      { path: 'all-assignments', element: <ProtectedRoute allowedRoles={['Super Admin','Admin']}><Lazy><AllAssignmentsPage /></Lazy></ProtectedRoute> },
      { path: 'admins', element: <ProtectedRoute allowedRoles={['Super Admin']}><Lazy><ManageAdminsPage /></Lazy></ProtectedRoute> },

      // Teacher
      { path: 'my-class', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><MyClassPage /></Lazy></ProtectedRoute> },
      { path: 'assignments', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><TeacherAssignmentsPage /></Lazy></ProtectedRoute> },
      { path: 'assignments/:assignmentId/grade', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><GradeSubmissionsPage /></Lazy></ProtectedRoute> },
      { path: 'progress', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><StudentProgressPage /></Lazy></ProtectedRoute> },

      // Student
      { path: 'my-assignments', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentAssignmentsPage /></Lazy></ProtectedRoute> },
      { path: 'my-grades', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><MyGradesPage /></Lazy></ProtectedRoute> },
      { path: 'setup', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentSetupPage /></Lazy></ProtectedRoute> },

      // Shared
      { path: 'settings', element: <Lazy><SettingsPage /></Lazy> },
    ],
  },
  { path: '/unauthorized', element: <Unauthorized /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}

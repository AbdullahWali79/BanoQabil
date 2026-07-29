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
import { effectiveAppRole } from '@/lib/roles';

// Lazy load all heavy pages to avoid a single bad import crashing the whole app
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const ManageTeachersPage = lazy(() => import('@/features/admin/pages/ManageTeachersPage'));
const ManageStudentsPage = lazy(() => import('@/features/admin/pages/ManageStudentsPage'));
const CoursesPage = lazy(() => import('@/features/admin/pages/CoursesPage'));
const ReportsPage = lazy(() => import('@/features/admin/pages/ReportsPage'));
const StudentFeesPage = lazy(() => import('@/features/admin/pages/StudentFeesPage'));

const SuperAdminDashboard = lazy(() => import('@/features/superadmin/pages/SuperAdminDashboard'));
const RolesPage = lazy(() => import('@/features/superadmin/pages/RolesPage'));
const ManageAdminsPage = lazy(() => import('@/features/superadmin/pages/ManageAdminsPage'));
const StaffPayPage = lazy(() => import('@/features/superadmin/pages/StaffPayPage'));

const TeacherDashboard = lazy(() => import('@/features/teacher/pages/TeacherDashboard'));
const MyClassPage = lazy(() => import('@/features/teacher/pages/MyClassPage'));
const TeacherStudentsPage = lazy(() => import('@/features/teacher/pages/TeacherStudentsPage'));
const TeacherAssignmentsPage = lazy(() => import('@/features/teacher/pages/TeacherAssignmentsPage'));
const GradeSubmissionsPage = lazy(() => import('@/features/teacher/pages/GradeSubmissionsPage'));
const StudentProgressPage = lazy(() => import('@/features/teacher/pages/StudentProgressPage'));
const TeacherAttendancePage = lazy(() => import('@/features/teacher/pages/TeacherAttendancePage'));
const TeacherNotificationsPage = lazy(() => import('@/features/teacher/pages/TeacherNotificationsPage'));

const StudentDashboard = lazy(() => import('@/features/student/pages/StudentDashboard'));
const StudentProfilePage = lazy(() => import('@/features/student/pages/StudentProfilePage'));
const StudentAttendancePage = lazy(() => import('@/features/student/pages/StudentAttendancePage'));
const StudentAssignmentsPage = lazy(() => import('@/features/student/pages/StudentAssignmentsPage'));
const MyGradesPage = lazy(() => import('@/features/student/pages/MyGradesPage'));
const MySubmissionsPage = lazy(() => import('@/features/student/pages/MySubmissionsPage.tsx'));
const StudentSetupPage = lazy(() => import('@/features/student/pages/StudentSetupPage'));
const StudentNotificationsPage = lazy(() => import('@/features/student/pages/StudentNotificationsPage'));

const SettingsPage = lazy(() => import('@/features/shared/pages/SettingsPage'));

// Loading spinner shown while lazy components load
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
    </div>
  );
}

// Role-aware Dashboard — shows the correct portal for each role
function RoleDashboard() {
  const { role, user, isLoading } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);

  if (isLoading || !appRole) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Welcome to BanoQabil</h1>
        <p className="text-muted-foreground mt-2">
          {isLoading ? 'Loading your dashboard...' : 'Unable to determine your role. Please log out and try again, or contact admin.'}
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {appRole === 'Super Admin' && <SuperAdminDashboard />}
      {appRole === 'Admin' && <AdminDashboard />}
      {appRole === 'Teacher' && <TeacherDashboard />}
      {appRole === 'Student' && <StudentDashboard />}
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

      // Super Admin only
      { path: 'roles', element: <ProtectedRoute allowedRoles={['Super Admin']}><Lazy><RolesPage /></Lazy></ProtectedRoute> },
      { path: 'admins', element: <ProtectedRoute allowedRoles={['Super Admin']}><Lazy><ManageAdminsPage /></Lazy></ProtectedRoute> },
      { path: 'staff-pay', element: <ProtectedRoute allowedRoles={['Super Admin']}><Lazy><StaffPayPage /></Lazy></ProtectedRoute> },

      // Admin + Super Admin (students approve by Admin; teachers approve/reject by Super Admin)
      { path: 'approvals', element: <ProtectedRoute allowedRoles={['Admin', 'Super Admin']}><PendingApprovalsPage /></ProtectedRoute> },
      { path: 'teachers', element: <ProtectedRoute allowedRoles={['Admin', 'Super Admin']}><Lazy><ManageTeachersPage /></Lazy></ProtectedRoute> },
      { path: 'students', element: <ProtectedRoute allowedRoles={['Admin']}><Lazy><ManageStudentsPage /></Lazy></ProtectedRoute> },
      { path: 'courses', element: <ProtectedRoute allowedRoles={['Admin']}><Lazy><CoursesPage /></Lazy></ProtectedRoute> },
      { path: 'fees', element: <ProtectedRoute allowedRoles={['Admin', 'Super Admin']}><Lazy><StudentFeesPage /></Lazy></ProtectedRoute> },
      { path: 'reports', element: <ProtectedRoute allowedRoles={['Admin']}><Lazy><ReportsPage /></Lazy></ProtectedRoute> },

      // Teacher
      // Assignments create/grade are teacher-only (not admin)
      { path: 'my-class', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><MyClassPage /></Lazy></ProtectedRoute> },
      { path: 'teacher-students', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><TeacherStudentsPage /></Lazy></ProtectedRoute> },
      { path: 'assignments', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><TeacherAssignmentsPage /></Lazy></ProtectedRoute> },
      { path: 'assignments/:assignmentId/grade', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><GradeSubmissionsPage /></Lazy></ProtectedRoute> },
      { path: 'attendance', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><TeacherAttendancePage /></Lazy></ProtectedRoute> },
      { path: 'notifications', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><TeacherNotificationsPage /></Lazy></ProtectedRoute> },
      { path: 'progress', element: <ProtectedRoute allowedRoles={['Teacher']}><Lazy><StudentProgressPage /></Lazy></ProtectedRoute> },

      // Student
      { path: 'my-profile', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentProfilePage /></Lazy></ProtectedRoute> },
      { path: 'my-attendance', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentAttendancePage /></Lazy></ProtectedRoute> },
      { path: 'my-assignments', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentAssignmentsPage /></Lazy></ProtectedRoute> },
      { path: 'my-submissions', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><MySubmissionsPage /></Lazy></ProtectedRoute> },
      { path: 'my-grades', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><MyGradesPage /></Lazy></ProtectedRoute> },
      { path: 'my-notifications', element: <ProtectedRoute allowedRoles={['Student']}><Lazy><StudentNotificationsPage /></Lazy></ProtectedRoute> },
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

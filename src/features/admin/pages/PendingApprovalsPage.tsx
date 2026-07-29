import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { UserCheck, UserX, ShieldCheck, Mail, Calendar, BookOpen } from 'lucide-react';
import { ensureStudentRow, ensureTeacherRow, relationOne } from '@/features/teacher/utils/teacherData';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';

type PendingUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  course_name: string | null;
  course_id: string | null;
};

export function PendingApprovalsPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);

  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPendingUsers = async () => {
    setIsLoading(true);
    setErrorMessage('');

    // Admin: students only. Super Admin: teachers only.
    const visibleForRole = (list: PendingUser[]) =>
      appRole === 'Super Admin'
        ? list.filter((u) => u.role === 'Teacher')
        : list.filter((u) => u.role === 'Student');

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        created_at,
        roles(name),
        students(course_id, courses(name))
      `)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback without students join if schema not ready
      const fallback = await supabase
        .from('profiles')
        .select(`id, full_name, email, created_at, roles(name)`)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (fallback.error) {
        setErrorMessage(fallback.error.message);
        setUsers([]);
      } else {
        setUsers(
          visibleForRole(
            (fallback.data ?? []).map((d: any) => {
              const roleRel = relationOne<{ name?: string }>(d.roles);
              return {
                id: d.id,
                full_name: d.full_name || 'Unknown User',
                email: d.email,
                role: roleRel?.name || 'Unknown',
                created_at: new Date(d.created_at).toLocaleDateString(),
                course_name: null,
                course_id: null,
              };
            }),
          ),
        );
      }
    } else {
      const mappedData = (data ?? []).map((d: any) => {
        const roleRel = relationOne<{ name?: string }>(d.roles);
        const studentRel = relationOne<{
          course_id?: string | null;
          courses?: { name?: string } | { name?: string }[] | null;
        }>(d.students);
        const course = relationOne(studentRel?.courses);
        return {
          id: d.id,
          full_name: d.full_name || 'Unknown User',
          email: d.email,
          role: roleRel?.name || 'Unknown',
          created_at: new Date(d.created_at).toLocaleDateString(),
          course_name: course?.name || null,
          course_id: studentRel?.course_id || null,
        };
      });
      setUsers(visibleForRole(mappedData));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchPendingUsers();
  }, [appRole]);

  const handleAction = async (user: PendingUser, status: 'Approved' | 'Rejected') => {
    const isTeacher = user.role === 'Teacher';
    if (isTeacher && appRole !== 'Super Admin') {
      setErrorMessage('Only Super Admin can approve/reject teacher accounts.');
      return;
    }

    // Treat teacher "Rejected" as suspended, so rejected teachers don't retain access.
    const desiredStatus = isTeacher && status === 'Rejected' ? 'Suspended' : status;

    setActionId(user.id);
    setErrorMessage('');

    const { error } = await supabase
      .from('profiles')
      .update({ status: desiredStatus })
      .eq('id', user.id);

    if (error) {
      setErrorMessage(error.message);
      setActionId(null);
      return;
    }

    if (desiredStatus === 'Approved') {
      try {
        const role = user.role.toLowerCase();
        if (role === 'teacher') {
          await ensureTeacherRow(user.id);
        } else if (role === 'student') {
          await ensureStudentRow(user.id, { course_id: user.course_id });
        }
      } catch (membershipError: any) {
        setErrorMessage(
          membershipError?.message ||
            'Approved, but could not create teacher/student record. Check RLS policies.',
        );
      }
    }

    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setActionId(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pending Approvals</h1>
        <p className="text-muted-foreground mt-2">
          {appRole === 'Super Admin'
            ? 'Review pending teacher registrations.'
            : 'Review pending student registrations. Teacher approvals are handled by Super Admin.'}
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {users.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No pending approvals</h3>
          <p>All caught up! There are no new registrations waiting for review.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'Admin' || user.role === 'Super Admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : user.role === 'Teacher'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Calendar size={12} className="mr-1" />
                    {user.created_at}
                  </span>
                </div>

                <h3 className="text-xl font-semibold mb-1 truncate" title={user.full_name}>
                  {user.full_name}
                </h3>

                <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span className="truncate" title={user.email}>
                      {user.email}
                    </span>
                  </div>
                  {user.course_name && (
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} />
                      <span className="truncate" title={user.course_name}>
                        {user.course_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 p-4 border-t flex gap-3">
                <Button
                  onClick={() => handleAction(user, 'Approved')}
                  disabled={actionId === user.id || (user.role === 'Teacher' && appRole !== 'Super Admin')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <UserCheck size={16} className="mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={actionId === user.id || (user.role === 'Teacher' && appRole !== 'Super Admin')}
                  onClick={() => handleAction(user, 'Rejected')}
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <UserX size={16} className="mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserCheck,
  UserX,
  ShieldCheck,
  Mail,
  Calendar,
  BookOpen,
  Eye,
  Phone,
  MapPin,
  X,
  RefreshCw,
} from 'lucide-react';
import { ensureStudentRow, ensureTeacherRow, relationOne } from '@/features/teacher/utils/teacherData';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';

type PendingUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  createdAtRaw: string | null;
  phone: string | null;
  address: string | null;
  course_name: string | null;
  course_id: string | null;
};

type DetailField = { label: string; value: string };

type DetailState = {
  user: PendingUser;
  loading: boolean;
  fields: DetailField[];
};

function DetailRow({ label, value }: DetailField) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border/60 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground break-words">{value || '—'}</dd>
    </div>
  );
}

export function PendingApprovalsPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);

  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const canActOn = (u: PendingUser) => {
    if (u.role === 'Teacher') return appRole === 'Super Admin';
    if (u.role === 'Student') return appRole === 'Admin' || appRole === 'Super Admin';
    return false;
  };

  const fetchPendingUsers = useCallback(async () => {
    setIsLoading(true);
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
        phone,
        address,
        created_at,
        roles(name),
        students(course_id, courses(name))
      `)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) {
      const fallback = await supabase
        .from('profiles')
        .select(`id, full_name, email, phone, address, created_at, roles(name)`)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (fallback.error) {
        toastError(fallback.error, 'Failed to load users.');
        setUsers([]);
      } else {
        setUsers(
          visibleForRole(
            (fallback.data ?? []).map((d: Record<string, unknown>) => {
              const roleRel = relationOne<{ name?: string }>(d.roles as never);
              return {
                id: String(d.id),
                full_name: String(d.full_name || 'Unknown User'),
                email: String(d.email || ''),
                role: roleRel?.name || 'Unknown',
                created_at: d.created_at
                  ? new Date(String(d.created_at)).toLocaleDateString()
                  : '—',
                createdAtRaw: d.created_at ? String(d.created_at) : null,
                phone: (d.phone as string | null) ?? null,
                address: (d.address as string | null) ?? null,
                course_name: null,
                course_id: null,
              };
            }),
          ),
        );
      }
    } else {
      const mappedData = (data ?? []).map((d: Record<string, unknown>) => {
        const roleRel = relationOne<{ name?: string }>(d.roles as never);
        const studentRel = relationOne<{
          course_id?: string | null;
          courses?: { name?: string } | { name?: string }[] | null;
        }>(d.students as never);
        const course = relationOne(studentRel?.courses as never) as { name?: string } | null;
        return {
          id: String(d.id),
          full_name: String(d.full_name || 'Unknown User'),
          email: String(d.email || ''),
          role: roleRel?.name || 'Unknown',
          created_at: d.created_at
            ? new Date(String(d.created_at)).toLocaleDateString()
            : '—',
          createdAtRaw: d.created_at ? String(d.created_at) : null,
          phone: (d.phone as string | null) ?? null,
          address: (d.address as string | null) ?? null,
          course_name: course?.name || null,
          course_id: studentRel?.course_id || null,
        };
      });
      setUsers(visibleForRole(mappedData));
    }
    setIsLoading(false);
  }, [appRole]);

  useEffect(() => {
    void fetchPendingUsers();
  }, [fetchPendingUsers]);

  const openView = async (pending: PendingUser) => {
    setDetail({ user: pending, loading: true, fields: [] });
    const fields: DetailField[] = [
      { label: 'Full name', value: pending.full_name },
      { label: 'Email', value: pending.email },
      { label: 'Role', value: pending.role },
      { label: 'Phone', value: pending.phone || '—' },
      { label: 'Address', value: pending.address || '—' },
      {
        label: 'Registered',
        value: pending.createdAtRaw
          ? new Date(pending.createdAtRaw).toLocaleString()
          : pending.created_at,
      },
      { label: 'Status', value: 'Pending' },
    ];

    try {
      if (pending.role === 'Student') {
        const { data: student } = await supabase
          .from('students')
          .select(
            `id, father_name, application_id, enrollment_date, gender, course_id, batch_id,
             courses(name), batches(name)`,
          )
          .eq('profile_id', pending.id)
          .maybeSingle();

        if (student) {
          const course = relationOne(student.courses as never) as { name?: string } | null;
          const batch = relationOne(student.batches as never) as { name?: string } | null;
          fields.push(
            { label: 'Father name', value: student.father_name || '—' },
            { label: 'Application ID', value: student.application_id || '—' },
            { label: 'Gender', value: student.gender || '—' },
            { label: 'Course', value: course?.name || pending.course_name || '—' },
            { label: 'Batch', value: batch?.name || '—' },
            {
              label: 'Enrollment date',
              value: student.enrollment_date
                ? new Date(String(student.enrollment_date)).toLocaleDateString()
                : '—',
            },
          );
        } else {
          fields.push({
            label: 'Student record',
            value: 'Not created yet (will be created on approve)',
          });
          if (pending.course_name) {
            fields.push({ label: 'Requested course', value: pending.course_name });
          }
        }
      }

      if (pending.role === 'Teacher') {
        let teacher: Record<string, unknown> | null = null;
        const full = await supabase
          .from('teachers')
          .select(
            `id, username, cnic, province, region, district, city, trainer_code, specialization,
             teacher_courses(gender_scope, courses(name))`,
          )
          .eq('profile_id', pending.id)
          .maybeSingle();
        if (full.error) {
          const basic = await supabase
            .from('teachers')
            .select('id, specialization, teacher_courses(gender_scope, courses(name))')
            .eq('profile_id', pending.id)
            .maybeSingle();
          teacher = (basic.data as Record<string, unknown> | null) ?? null;
        } else {
          teacher = (full.data as Record<string, unknown> | null) ?? null;
        }

        if (teacher) {
          const tc = relationOne(teacher.teacher_courses as never) as {
            gender_scope?: string | null;
            courses?: { name?: string } | { name?: string }[] | null;
          } | null;
          const course = relationOne(tc?.courses as never) as { name?: string } | null;
          fields.push(
            { label: 'Username', value: String(teacher.username || '—') },
            { label: 'Trainer code', value: String(teacher.trainer_code || '—') },
            { label: 'CNIC', value: String(teacher.cnic || '—') },
            { label: 'Specialization', value: String(teacher.specialization || '—') },
            { label: 'Province', value: String(teacher.province || '—') },
            { label: 'Region', value: String(teacher.region || '—') },
            { label: 'District', value: String(teacher.district || '—') },
            { label: 'City', value: String(teacher.city || '—') },
            { label: 'Course', value: course?.name || '—' },
            { label: 'Class scope', value: tc?.gender_scope || '—' },
          );
        } else {
          fields.push({
            label: 'Teacher record',
            value: 'Not created yet (will be created on approve)',
          });
        }
      }
    } catch {
      // Keep base profile fields even if extra fetch fails
    }

    setDetail({ user: pending, loading: false, fields });
  };

  const handleApprove = async (pending: PendingUser) => {
    if (!canActOn(pending)) {
      toastError(
        pending.role === 'Teacher'
          ? 'Only Super Admin can approve teachers.'
          : 'Only Admin can approve students.',
      );
      return;
    }

    const ok = await askConfirm({
      title: `Approve ${pending.role.toLowerCase()}?`,
      description: `Are you sure you want to approve "${pending.full_name}" (${pending.email})?`,
      confirmLabel: 'Yes, approve',
      cancelLabel: 'Cancel',
      tone: 'default',
    });
    if (!ok) return;

    setActionId(pending.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'Approved',
          rejection_reason: null,
          rejected_at: null,
          rejected_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pending.id);

      if (error) {
        // Fallback if rejection columns not migrated yet
        if (/rejection_reason|rejected_at|rejected_by/i.test(error.message)) {
          const retry = await supabase
            .from('profiles')
            .update({ status: 'Approved', updated_at: new Date().toISOString() })
            .eq('id', pending.id);
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }

      try {
        const r = pending.role.toLowerCase();
        if (r === 'teacher') await ensureTeacherRow(pending.id);
        else if (r === 'student') {
          await ensureStudentRow(pending.id, { course_id: pending.course_id });
        }
      } catch (membershipError: unknown) {
        toastError(membershipError, 'Approved, but setup failed.');
      }

      toastSuccess(`${pending.role} approved.`);
      setUsers((prev) => prev.filter((u) => u.id !== pending.id));
      setDetail(null);
    } catch (err: unknown) {
      toastError(err, 'Something went wrong.');
    } finally {
      setActionId(null);
    }
  };

  const openReject = (pending: PendingUser) => {
    if (!canActOn(pending)) {
      toastError(
        pending.role === 'Teacher'
          ? 'Only Super Admin can reject teachers.'
          : 'Only Admin can reject students.',
      );
      return;
    }
    setRejectTarget(pending);
    setRejectReason('');
    setRejectError('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setRejectError('Please enter a reject reason (at least 5 characters).');
      return;
    }

    setActionId(rejectTarget.id);
    try {
      const isTeacher = rejectTarget.role === 'Teacher';
      const desiredStatus = isTeacher ? 'Suspended' : 'Rejected';
      const payload: Record<string, unknown> = {
        status: desiredStatus,
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
        rejected_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', rejectTarget.id);
      if (error) {
        if (/rejection_reason|rejected_at|rejected_by/i.test(error.message)) {
          const retry = await supabase
            .from('profiles')
            .update({ status: desiredStatus, updated_at: new Date().toISOString() })
            .eq('id', rejectTarget.id);
          if (retry.error) throw retry.error;
          toastSuccess(`${rejectTarget.role} rejected. (Run SQL patch to store reject reason.)`);
        } else {
          throw error;
        }
      } else {
        toastSuccess(`${rejectTarget.role} rejected.`);
      }

      setUsers((prev) => prev.filter((u) => u.id !== rejectTarget.id));
      setRejectTarget(null);
      setRejectReason('');
      setDetail(null);
    } catch (err: unknown) {
      toastError(err, 'Something went wrong.');
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pending Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {appRole === 'Super Admin'
              ? 'Review pending teacher registrations. Open View for full details before deciding.'
              : 'Review pending student registrations. Open View for full details before deciding.'}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void fetchPendingUsers()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground">No pending approvals</h3>
          <p>All caught up! There are no new registrations waiting for review.</p>
        </div>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="border-b bg-muted/20 px-5 py-3">
              <p className="text-sm font-medium">
                {users.length} pending {users.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Extra</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            u.role === 'Teacher'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {u.phone || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.course_name ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <BookOpen className="h-3.5 w-3.5" />
                            {u.course_name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {u.created_at}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => void openView(u)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={actionId === u.id || !canActOn(u)}
                            onClick={() => void handleApprove(u)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                            disabled={actionId === u.id || !canActOn(u)}
                            onClick={() => openReject(u)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View details modal */}
      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-hidden border-none shadow-xl">
            <CardContent className="flex max-h-[90vh] flex-col p-0">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Registration details
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{detail.user.full_name}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {detail.user.email}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDetail(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {detail.loading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : (
                  <dl>
                    {detail.fields.map((f) => (
                      <DetailRow key={f.label} label={f.label} value={f.value} />
                    ))}
                    {detail.user.address ? (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{detail.user.address}</span>
                      </div>
                    ) : null}
                  </dl>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t bg-muted/20 px-5 py-4">
                <Button
                  className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={
                    detail.loading ||
                    actionId === detail.user.id ||
                    !canActOn(detail.user)
                  }
                  onClick={() => void handleApprove(detail.user)}
                >
                  <UserCheck className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={
                    detail.loading ||
                    actionId === detail.user.id ||
                    !canActOn(detail.user)
                  }
                  onClick={() => openReject(detail.user)}
                >
                  <UserX className="h-4 w-4" />
                  Reject
                </Button>
                <Button variant="ghost" className="ml-auto" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Reject reason modal */}
      {rejectTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Reject registration?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Rejecting <span className="font-semibold text-foreground">{rejectTarget.full_name}</span>
                    . A reason is required.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectReason('');
                    setRejectError('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reject reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  className="min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Incomplete documents / Invalid CNIC / Duplicate account…"
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                />
                {rejectError ? <p className="text-xs text-rose-600">{rejectError}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
                  disabled={actionId === rejectTarget.id}
                  onClick={() => void submitReject()}
                >
                  {actionId === rejectTarget.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                  Confirm reject
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionId === rejectTarget.id}
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectReason('');
                    setRejectError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

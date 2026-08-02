import { useEffect, useMemo, useState } from 'react';
import { supabase, createEphemeralAuthClient } from '@/lib/supabase';
import { toastSuccess, toastError } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Edit,
  GraduationCap,
  RefreshCw,
  Plus,
  Trash2,
  X,
  KeyRound,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ensureStudentRow, relationOne } from '@/features/teacher/utils/teacherData';
import {
  adminSetUserPassword,
  adminSetUserEmail,
} from '@/lib/adminPassword';
import {
  APPLICATION_ID_LENGTH,
  generateUniqueApplicationId,
  isApplicationIdTaken,
  validateApplicationIdFormat,
} from '@/lib/applicationId';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
};

type StudentRow = {
  id: string;
  father_name: string | null;
  application_id: string | null;
  enrollment_date: string | null;
  batch_id: string | null;
  course_id: string | null;
  gender: string | null;
  profiles: Profile | Profile[];
  batches?: { id: string; name: string } | { id: string; name: string }[] | null;
  courses?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type StudentForm = {
  full_name: string;
  email: string;
  phone: string;
  father_name: string;
  application_id: string;
  gender: string;
  course_id: string;
  batch_id: string;
  status: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: StudentForm = {
  full_name: '',
  email: '',
  phone: '',
  father_name: '',
  application_id: '',
  gender: '',
  course_id: '',
  batch_id: '',
  status: 'Approved',
  password: '',
  confirmPassword: '',
};

function cleanBatchLabel(name: string) {
  return name.replace(/^tid:[a-f0-9-]+\|/i, '');
}

export default function ManageStudentsPage() {
  const { can: canPerm, denyMessage } = usePermission();
  const canResetPasswords = canPerm('can_reset_passwords');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [viewing, setViewing] = useState<StudentRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentRoleId, setStudentRoleId] = useState<string | null>(null);
  const [useAppIdAsPassword, setUseAppIdAsPassword] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Approved' | 'Suspended' | 'Pending'>('All');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [resetTarget, setResetTarget] = useState<StudentRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [generatingAppId, setGeneratingAppId] = useState(false);
  const [appIdCheck, setAppIdCheck] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });

  const setField = (key: keyof StudentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoGenerateAppId = async () => {
    setGeneratingAppId(true);
    try {
      const appId = await generateUniqueApplicationId();
      setField('application_id', appId);
    } catch (err: unknown) {
      toastError(err, 'Could not generate ID.');
    } finally {
      setGeneratingAppId(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const [{ data, error }, batchesRes, coursesRes] = await Promise.all([
      supabase
        .from('students')
        .select(
          `id, father_name, application_id, enrollment_date, batch_id, course_id, gender,
           profiles!inner(id, full_name, email, phone, status),
           batches(id, name),
           courses(id, name)`,
        )
        .order('id'),
      supabase.from('batches').select('id, name').order('name'),
      supabase.from('courses').select('id, name').order('name'),
    ]);

    if (error) {
      toastError(error, 'Something went wrong.');
      setStudents([]);
    } else {
      setStudents((data as StudentRow[]) ?? []);
    }
    setBatches(
      (batchesRes.data ?? []).map((b) => ({ id: b.id, name: cleanBatchLabel(b.name) })),
    );
    setCourses((coursesRes.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('roles').select('id, name').then(({ data }) => {
      setStudentRoleId(data?.find((r) => r.name === 'Student')?.id ?? null);
    });
    fetchStudents();
  }, []);

  // Live Application ID format + uniqueness check while typing
  useEffect(() => {
    if (!editing && !showAdd) {
      setAppIdCheck({ status: 'idle', message: '' });
      return;
    }

    const raw = form.application_id.trim();
    if (!raw) {
      setAppIdCheck({ status: 'idle', message: '' });
      return;
    }

    const formatErr = validateApplicationIdFormat(raw);
    if (formatErr) {
      setAppIdCheck({ status: 'invalid', message: formatErr });
      return;
    }

    let cancelled = false;
    setAppIdCheck({ status: 'checking', message: 'Checking uniqueness…' });
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isApplicationIdTaken(raw, editing?.id ?? null);
        if (cancelled) return;
        if (taken) {
          setAppIdCheck({
            status: 'invalid',
            message: 'This Application ID is already used.',
          });
        } else {
          setAppIdCheck({
            status: 'valid',
            message: 'Application ID is unique.',
          });
        }
      } catch {
        if (!cancelled) setAppIdCheck({ status: 'idle', message: '' });
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.application_id, editing, showAdd]);

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return students.filter((s) => {
      if (genderFilter !== 'All' && s.gender !== genderFilter) return false;
      const course = relationOne(s.courses);
      if (courseFilter !== 'All' && course?.id !== courseFilter) return false;
      const p = relationOne(s.profiles);
      if (statusFilter !== 'All' && (p?.status || '') !== statusFilter) return false;
      if (!q) return true;
      const batch = relationOne(s.batches);
      return (
        p?.full_name?.toLowerCase().includes(q) ||
        p?.email?.toLowerCase().includes(q) ||
        s.application_id?.toLowerCase().includes(q) ||
        p?.phone?.toLowerCase().includes(q) ||
        course?.name?.toLowerCase().includes(q) ||
        cleanBatchLabel(batch?.name || '').toLowerCase().includes(q)
      );
    });
  }, [students, search, genderFilter, courseFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

  const pagedStudents = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page, totalPages]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, genderFilter, courseFilter, statusFilter]);

  const genderCounts = useMemo(() => {
    return {
      All: students.length,
      Female: students.filter((s) => s.gender === 'Female').length,
      Male: students.filter((s) => s.gender === 'Male').length,
    };
  }, [students]);

  const assignedCount = useMemo(
    () => students.filter((s) => s.batch_id).length,
    [students],
  );

  const openAdd = () => {
    setForm(emptyForm);
    setUseAppIdAsPassword(false);
    setEditing(null);
    setShowAdd(true);
  };

  const openEdit = (student: StudentRow) => {
    const p = relationOne(student.profiles);
    setEditing(student);
    setForm({
      full_name: p?.full_name || '',
      email: p?.email || '',
      phone: p?.phone || '',
      father_name: student.father_name || '',
      application_id: student.application_id || '',
      gender: student.gender || '',
      course_id: student.course_id || '',
      batch_id: student.batch_id || '',
      status: p?.status || 'Approved',
      password: '',
      confirmPassword: '',
    });
    setShowAdd(false);
  };

  const openResetPassword = (student: StudentRow) => {
    if (!canResetPasswords) {
      toastError(denyMessage('can_reset_passwords'));
      return;
    }
    setResetTarget(student);
    setResetPassword('');
    setResetConfirm('');
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const profile = relationOne(resetTarget.profiles);
    if (!profile?.id) return;

    if (resetPassword.length < 6) {
      toastError('New password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirm) {
      toastError('Password and Confirm Password do not match.');
      return;
    }

    setResetting(true);
    try {
      await adminSetUserPassword(profile.id, resetPassword);
      toastSuccess('Password updated.');
      setResetTarget(null);
    } catch (err: unknown) {
      toastError(err, 'Password update failed.');
    } finally {
      setResetting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.full_name.trim() || !form.email.trim()) {
      toastError('Name and email are required.');
      return;
    }
    if (!form.application_id.trim()) {
      toastError('Application ID is required.');
      return;
    }
    const formatErr = validateApplicationIdFormat(form.application_id);
    if (formatErr) {
      toastError(formatErr);
      return;
    }
    const newEmail = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toastError('Enter a valid email address.');
      return;
    }

    setSaving(true);

    const profile = relationOne(editing.profiles);
    const profileId = profile?.id;
    if (!profileId) {
      toastError('Student profile missing.');
      setSaving(false);
      return;
    }

    const appId = form.application_id.trim();
    const taken = await isApplicationIdTaken(appId, editing.id);
    if (taken) {
      toastError('Application ID already in use.');
      setSaving(false);
      return;
    }

    const oldEmail = (profile?.email || '').trim().toLowerCase();
    const emailChanged = newEmail !== oldEmail;

    // If email changed, update Auth first so login matches (also syncs profiles.email via service role).
    if (emailChanged) {
      try {
        await adminSetUserEmail(profileId, newEmail);
      } catch (err: unknown) {
        toastError(err, 'Email update failed.');
        setSaving(false);
        return;
      }
    }

    const [{ error: profileError }, { error: studentError }] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          email: newEmail,
          phone: form.phone.trim() || null,
          status: form.status,
        })
        .eq('id', profileId),
      supabase
        .from('students')
        .update({
          father_name: form.father_name.trim() || null,
          application_id: appId,
          gender: form.gender || null,
          course_id: form.course_id || null,
          batch_id: form.batch_id || null,
        })
        .eq('id', editing.id),
    ]);

    if (profileError || studentError) {
      const raw = profileError?.message || studentError?.message || 'Update failed';
      if (/unique|duplicate/i.test(raw)) {
        toastError('Application ID already in use.');
      } else {
        toastError(profileError || studentError, 'Update failed');
      }
      setSaving(false);
      return;
    }

    toastSuccess('Student updated.');
    setEditing(null);
    setSaving(false);
    await fetchStudents();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim() || !form.email.trim()) {
      toastError('Name and email are required.');
      return;
    }
    if (!form.application_id.trim()) {
      toastError('Application ID is required.');
      return;
    }
    const formatErr = validateApplicationIdFormat(form.application_id);
    if (formatErr) {
      toastError(formatErr);
      return;
    }
    if (!studentRoleId) {
      toastError('Student role not found.');
      return;
    }

    const appId = form.application_id.trim();
    const taken = await isApplicationIdTaken(appId);
    if (taken) {
      toastError('Application ID already in use.');
      return;
    }

    const password = useAppIdAsPassword
      ? appId
      : form.password.trim();

    if (password.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (!useAppIdAsPassword && password !== form.confirmPassword.trim()) {
      toastError('Password and Confirm Password do not match.');
      return;
    }

    setSaving(true);
    try {
      const ephemeral = createEphemeralAuthClient();
      const { data: authData, error: signUpError } = await ephemeral.auth.signUp({
        email: form.email.trim(),
        password,
        options: {
          data: {
            full_name: form.full_name.trim(),
            role: 'Student',
            application_id: appId,
          },
        },
      });
      if (signUpError) throw new Error(signUpError.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Student account was not created.');

      await new Promise((r) => setTimeout(r, 600));

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .limit(1);

      const profilePatch = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role_id: studentRoleId,
        status: form.status || 'Approved',
      };

      if (existingProfile?.[0]) {
        const { error } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('profiles').insert({ id: userId, ...profilePatch });
        if (error) throw new Error(error.message);
      }

      await ensureStudentRow(userId, {
        course_id: form.course_id || null,
        batch_id: form.batch_id || null,
        application_id: appId,
      });

      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({
          father_name: form.father_name.trim() || null,
          application_id: appId,
          gender: form.gender || null,
          course_id: form.course_id || null,
          batch_id: form.batch_id || null,
        })
        .eq('profile_id', userId);

      if (studentUpdateError) {
        const raw = studentUpdateError.message;
        throw new Error(
          /unique|duplicate/i.test(raw)
            ? `Application ID "${appId}" must be unique.`
            : raw,
        );
      }

      toastSuccess(
        (form.status || 'Approved') === 'Pending' ? 'Student added (pending).' : 'Student added.',
      );
      setShowAdd(false);
      setForm(emptyForm);
      await fetchStudents();
    } catch (err: any) {
      toastError(err, 'Failed to add student.');
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (student: StudentRow) => {
    const p = relationOne(student.profiles);
    const ok = await askConfirm({
      title: 'Delete student record?',
      description: `Are you sure you want to remove "${p?.full_name || 'this student'}"?\n\nThis deletes their student record and suspends the account. Auth login may still exist.`,
      confirmLabel: 'Yes, delete student',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const { error: delError } = await supabase.from('students').delete().eq('id', student.id);
    if (delError) {
      toastError(delError, 'Something went wrong.');
      return;
    }
    if (p?.id) {
      await supabase.from('profiles').update({ status: 'Suspended' }).eq('id', p.id);
    }
    toastSuccess('Student removed.');
    await fetchStudents();
  };

  const syncMissingRows = async () => {
    setSyncing(true);
    try {
      if (!studentRoleId) {
        toastError('Student role not found.');
        setSyncing(false);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'Approved')
        .eq('role_id', studentRoleId);

      for (const profile of profiles ?? []) {
        await ensureStudentRow(profile.id);
      }
      toastSuccess('Students synced.');
      await fetchStudents();
    } catch (err: unknown) {
      toastError(err, 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const formFields = (mode: 'add' | 'edit') => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium">
          Full Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.full_name}
          onChange={(e) => setField('full_name', e.target.value)}
          placeholder="Student full name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Email <span className="text-destructive">*</span>
        </label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          placeholder="student@gmail.com"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Phone</label>
        <Input
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          placeholder="03XXXXXXXXX"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Father Name</label>
        <Input
          value={form.father_name}
          onChange={(e) => setField('father_name', e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Application ID <span className="text-destructive">*</span>
        </label>
        <div className="flex gap-1.5">
          <Input
            value={form.application_id}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, APPLICATION_ID_LENGTH);
              setField('application_id', digits);
            }}
            placeholder="7 digits e.g. 3117830"
            required={mode === 'add'}
            inputMode="numeric"
            maxLength={APPLICATION_ID_LENGTH}
            className="font-mono"
            aria-invalid={appIdCheck.status === 'invalid'}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={generatingAppId}
            onClick={handleAutoGenerateAppId}
            title="Auto Generate"
            aria-label="Auto Generate Application ID"
          >
            {generatingAppId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>
        {appIdCheck.status !== 'idle' ? (
          <p
            className={`flex items-center gap-1.5 text-xs ${
              appIdCheck.status === 'valid'
                ? 'text-green-600'
                : appIdCheck.status === 'checking'
                  ? 'text-muted-foreground'
                  : 'text-destructive'
            }`}
          >
            {appIdCheck.status === 'valid' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : appIdCheck.status === 'checking' ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            {appIdCheck.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Exactly {APPLICATION_ID_LENGTH} digits · must be unique
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Gender</label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.gender}
          onChange={(e) => setField('gender', e.target.value)}
        >
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Course</label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.course_id}
          onChange={(e) => setField('course_id', e.target.value)}
        >
          <option value="">Unassigned</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Batch / Class</label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.batch_id}
          onChange={(e) => setField('batch_id', e.target.value)}
        >
          <option value="">Unassigned</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.status}
          onChange={(e) => setField('status', e.target.value)}
        >
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>
      {mode === 'add' && (
        <div className="space-y-3 sm:col-span-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={useAppIdAsPassword}
              onChange={(e) => setUseAppIdAsPassword(e.target.checked)}
            />
            Use Application ID as Password
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Password {!useAppIdAsPassword ? <span className="text-destructive">*</span> : null}
              </label>
              <Input
                type="password"
                value={useAppIdAsPassword ? form.application_id : form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Min 6 characters"
                required={!useAppIdAsPassword}
                disabled={useAppIdAsPassword}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Confirm Password{' '}
                {!useAppIdAsPassword ? <span className="text-destructive">*</span> : null}
              </label>
              <Input
                type="password"
                value={useAppIdAsPassword ? form.application_id : form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                required={!useAppIdAsPassword}
                disabled={useAppIdAsPassword}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manage Students</h1>
          <p className="text-muted-foreground mt-1">
            Search, filter, and manage students — 100 per page.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={syncMissingRows} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Records
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Student
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold mt-1">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-pink-700 uppercase tracking-wide font-medium">Female</p>
            <p className="text-2xl font-bold mt-1 text-pink-800">{genderCounts.Female}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-sky-700 uppercase tracking-wide font-medium">Male</p>
            <p className="text-2xl font-bold mt-1 text-sky-800">{genderCounts.Male}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">In Batch</p>
            <p className="text-2xl font-bold mt-1">{assignedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b space-y-3 bg-muted/20">
            <div className="flex flex-wrap gap-2">
              {(['All', 'Female', 'Male'] as const).map((g) => (
                <Button
                  key={g}
                  type="button"
                  size="sm"
                  variant={genderFilter === g ? 'default' : 'outline'}
                  onClick={() => setGenderFilter(g)}
                >
                  {g} ({genderCounts[g]})
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72 max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, phone, app ID, course..."
                  className="pl-9 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="All">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="All">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Suspended">Suspended</option>
                <option value="Pending">Pending</option>
              </select>
              <p className="text-sm text-muted-foreground ml-auto">
                {filteredStudents.length} result(s)
                {filteredStudents.length > PAGE_SIZE
                  ? ` · Page ${Math.min(page, totalPages)} / ${totalPages}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-semibold">SR#</th>
                  <th className="px-4 py-3 font-semibold">App ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Gender</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    </td>
                  </tr>
                ) : pagedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12">
                      <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No students found</p>
                      <Button className="mt-4 gap-2" onClick={openAdd}>
                        <Plus className="w-4 h-4" /> Add Student
                      </Button>
                    </td>
                  </tr>
                ) : (
                  pagedStudents.map((s, index) => {
                    const profile = relationOne(s.profiles);
                    const batch = relationOne(s.batches);
                    const course = relationOne(s.courses);
                    const sr = (Math.min(page, totalPages) - 1) * PAGE_SIZE + index + 1;
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-medium">{sr}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.application_id || '—'}</td>
                        <td className="px-4 py-3 font-medium">{profile?.full_name || '—'}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{profile?.email || '—'}</p>
                          <p className="text-xs text-muted-foreground">{profile?.phone || 'No phone'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[140px]">{course?.name || '—'}</td>
                        <td className="px-4 py-3">
                          {batch ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted">
                              {cleanBatchLabel(batch.name)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.gender === 'Female' ? (
                            <span className="inline-flex rounded-md bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-800">
                              Female
                            </span>
                          ) : s.gender === 'Male' ? (
                            <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                              Male
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              profile?.status === 'Approved'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : profile?.status === 'Suspended'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                          >
                            {profile?.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View details"
                              onClick={() => setViewing(s)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => openEdit(s)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reset Password"
                              disabled={!canResetPasswords}
                              onClick={() => openResetPassword(s)}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Remove"
                              onClick={() => removeStudent(s)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredStudents.length > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 bg-muted/10">
              <p className="text-sm text-muted-foreground">
                Showing {(Math.min(page, totalPages) - 1) * PAGE_SIZE + 1}–
                {Math.min(Math.min(page, totalPages) * PAGE_SIZE, filteredStudents.length)} of{' '}
                {filteredStudents.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium px-2">
                  {Math.min(page, totalPages)} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-5">
              {(() => {
                const profile = relationOne(viewing.profiles);
                const batch = relationOne(viewing.batches);
                const course = relationOne(viewing.courses);
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold">Student Details</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {profile?.full_name || '—'}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setViewing(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          profile?.status === 'Approved'
                            ? 'bg-green-100 text-green-800'
                            : profile?.status === 'Suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {profile?.status || '—'}
                      </span>
                      {viewing.gender === 'Female' ? (
                        <span className="inline-flex rounded-md bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-800">
                          Female
                        </span>
                      ) : viewing.gender === 'Male' ? (
                        <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                          Male
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      {(
                        [
                          ['Application ID', viewing.application_id || '—'],
                          ['Email', profile?.email || '—'],
                          ['Phone', profile?.phone || '—'],
                          ['Father Name', viewing.father_name || '—'],
                          ['Gender', viewing.gender || '—'],
                          ['Course', course?.name || 'Unassigned'],
                          ['Batch', batch ? cleanBatchLabel(batch.name) : 'Unassigned'],
                          [
                            'Enrollment',
                            viewing.enrollment_date
                              ? new Date(viewing.enrollment_date).toLocaleDateString()
                              : '—',
                          ],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-0.5 font-medium break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <Button variant="outline" onClick={() => setViewing(null)}>
                        Close
                      </Button>
                      <Button
                        onClick={() => {
                          const s = viewing;
                          setViewing(null);
                          openEdit(s);
                        }}
                      >
                        Edit Student
                      </Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Student</h2>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {formFields('edit')}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add Student</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                {formFields('add')}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Student'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {relationOne(resetTarget.profiles)?.full_name} ·{' '}
                    {relationOne(resetTarget.profiles)?.email}
                  </p>
                  {resetTarget.application_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Application ID: <span className="font-mono">{resetTarget.application_id}</span>
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setResetTarget(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  name="bq_student_new_password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  name="bq_student_confirm_password"
                  autoComplete="new-password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? 'Updating...' : 'Set New Password'}
                </Button>
                <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={resetting}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase, createEphemeralAuthClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  RefreshCw,
  UserCheck,
  X,
  KeyRound,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ensureTeacherRow, relationOne, setTeacherCourseAssignment, type GenderScope } from '@/features/teacher/utils/teacherData';
import {
  adminSetUserPassword,
  adminSetUserEmail,
} from '@/lib/adminPassword';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';

type TeacherRow = {
  id: string;
  specialization: string | null;
  username: string | null;
  cnic: string | null;
  province: string | null;
  region: string | null;
  district: string | null;
  city: string | null;
  experience: string | null;
  address: string | null;
  trainer_code: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
    address: string | null;
    created_at: string | null;
  };
};

type TeacherForm = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  cnic: string;
  province: string;
  region: string;
  district: string;
  city: string;
  experience: string;
  address: string;
  trainer_code: string;
  specialization: string;
  status: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: TeacherForm = {
  full_name: '',
  username: '',
  email: '',
  phone: '',
  cnic: '',
  province: '',
  region: '',
  district: '',
  city: '',
  experience: '',
  address: '',
  trainer_code: '',
  specialization: '',
  status: 'Pending',
  password: '',
  confirmPassword: '',
};

const TEACHER_SELECT = `
  id,
  specialization,
  username,
  cnic,
  province,
  region,
  district,
  city,
  experience,
  address,
  trainer_code,
  profiles!inner(id, full_name, email, phone, status, address, created_at)
`;

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

type CourseOption = { id: string; name: string };

export default function ManageTeachersPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const canChangeTeacherStatus = appRole === 'Super Admin';
  /** Super Admin only: edit teacher username/email and delete teachers */
  const canEditTeacherCredentials = appRole === 'Super Admin';
  const canDeleteTeacher = appRole === 'Super Admin';

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Approved' | 'Suspended' | 'Pending' | 'Rejected'
  >('All');
  const [genderFilter, setGenderFilter] = useState<'All' | GenderScope | 'None'>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherRoleId, setTeacherRoleId] = useState<string | null>(null);
  const [useUsernameAsPassword, setUseUsernameAsPassword] = useState(false);
  const [resetTarget, setResetTarget] = useState<TeacherRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [genderScope, setGenderScope] = useState<GenderScope | ''>('');
  const [teacherCourseMap, setTeacherCourseMap] = useState<Record<string, string[]>>({});
  const [teacherScopeMap, setTeacherScopeMap] = useState<Record<string, GenderScope | undefined>>({});

  const setField = (key: keyof TeacherForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fetchTeacherCourses = async (teacherList: TeacherRow[]) => {
    const ids = teacherList.map((t) => t.id);
    if (ids.length === 0) {
      setTeacherCourseMap({});
      setTeacherScopeMap({});
      return;
    }
    let data: any[] | null = null;
    const withScope = await supabase
      .from('teacher_courses')
      .select('teacher_id, course_id, gender_scope')
      .in('teacher_id', ids);
    if (withScope.error) {
      const fallback = await supabase
        .from('teacher_courses')
        .select('teacher_id, course_id')
        .in('teacher_id', ids);
      data = fallback.data;
    } else {
      data = withScope.data;
    }
    const map: Record<string, string[]> = {};
    const scopes: Record<string, GenderScope> = {};
    for (const row of data ?? []) {
      if (!map[row.teacher_id]) map[row.teacher_id] = [];
      map[row.teacher_id].push(row.course_id);
      if (row.gender_scope === 'Male' || row.gender_scope === 'Female' || row.gender_scope === 'Both') {
        scopes[row.teacher_id] = row.gender_scope;
      }
      // null / missing → leave unset so UI shows "Not set"
    }
    setTeacherCourseMap(map);
    setTeacherScopeMap(scopes);
  };

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select(TEACHER_SELECT)
      .order('id');

    if (error) {
      setTeachers([]);
      setMessage({ type: 'error', text: error.message });
    } else {
      const list = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const profiles = relationOne(
          row.profiles as TeacherRow['profiles'] | TeacherRow['profiles'][] | null,
        );
        return {
          ...(row as Omit<TeacherRow, 'profiles'>),
          profiles: profiles ?? {
            id: '',
            full_name: null,
            email: null,
            phone: null,
            status: null,
            address: null,
            created_at: null,
          },
        };
      });
      setTeachers(list);
      await fetchTeacherCourses(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('roles').select('id, name').then(({ data }) => {
      const teacherRole = data?.find((r) => r.name === 'Teacher');
      setTeacherRoleId(teacherRole?.id ?? null);
    });
    supabase
      .from('courses')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCourses((data as CourseOption[]) ?? []));
    fetchTeachers();
  }, []);

  const coursePicker = (
    <div className="space-y-4">
      <div className="space-y-2">
        <FieldLabel>Assigned Course</FieldLabel>
        <p className="text-xs text-muted-foreground">
          Pick one course, or No Course. Same course cannot be given twice for the same gender group.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 rounded-md border p-3 max-h-48 overflow-y-auto">
          <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
            <input
              type="radio"
              name="teacher-assigned-course"
              className="h-4 w-4"
              checked={selectedCourseIds.length === 0}
              onChange={() => {
                setSelectedCourseIds([]);
                setGenderScope('');
              }}
            />
            <span className="font-medium">No Course</span>
          </label>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-2">No courses found.</p>
          ) : (
            courses.map((course) => (
              <label key={course.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="teacher-assigned-course"
                  className="h-4 w-4"
                  checked={selectedCourseIds[0] === course.id}
                  onChange={() => setSelectedCourseIds([course.id])}
                />
                <span>{course.name}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Class Gender (who they teach)</FieldLabel>
        <p className="text-xs text-muted-foreground">
          Change anytime (Male ↔ Female ↔ Both). If not selected, teacher sees <strong>no students</strong>.
          Overlaps auto-adjust other teachers when you confirm on save.
        </p>
        <div className="flex flex-wrap gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
              genderScope === '' ? 'border-primary bg-primary/5' : ''
            } ${selectedCourseIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="radio"
              name="teacher-gender-scope"
              className="h-4 w-4"
              disabled={selectedCourseIds.length === 0}
              checked={genderScope === ''}
              onChange={() => setGenderScope('')}
            />
            Not set (no students)
          </label>
          {(['Male', 'Female', 'Both'] as GenderScope[]).map((opt) => (
            <label
              key={opt}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                genderScope === opt ? 'border-primary bg-primary/5' : ''
              } ${selectedCourseIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                type="radio"
                name="teacher-gender-scope"
                className="h-4 w-4"
                disabled={selectedCourseIds.length === 0}
                checked={genderScope === opt}
                onChange={() => setGenderScope(opt)}
              />
              {opt === 'Male' ? 'Only Male' : opt === 'Female' ? 'Only Female' : 'Both'}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const filteredTeachers = useMemo(() => {
    const q = search.toLowerCase();
    return teachers.filter((t) => {
      const status = t.profiles?.status || '';
      if (statusFilter !== 'All' && status !== statusFilter) return false;

      const hasCourse = (teacherCourseMap[t.id] ?? []).length > 0;
      const scope = teacherScopeMap[t.id];
      if (genderFilter === 'None' && hasCourse) return false;
      if (genderFilter === 'Male' || genderFilter === 'Female' || genderFilter === 'Both') {
        if (!hasCourse || scope !== genderFilter) return false;
      }

      return (
        t.profiles?.full_name?.toLowerCase().includes(q) ||
        t.profiles?.email?.toLowerCase().includes(q) ||
        t.username?.toLowerCase().includes(q) ||
        t.cnic?.toLowerCase().includes(q) ||
        t.city?.toLowerCase().includes(q) ||
        t.specialization?.toLowerCase().includes(q)
      );
    });
  }, [teachers, search, statusFilter, genderFilter, teacherCourseMap, teacherScopeMap]);

  const teacherStats = useMemo(() => {
    let maleOnly = 0;
    let femaleOnly = 0;
    let both = 0;
    let noCourse = 0;
    for (const t of teachers) {
      const has = (teacherCourseMap[t.id] ?? []).length > 0;
      if (!has) {
        noCourse += 1;
        continue;
      }
      const s = teacherScopeMap[t.id] || 'Both';
      if (s === 'Male') maleOnly += 1;
      else if (s === 'Female') femaleOnly += 1;
      else both += 1;
    }
    return { total: teachers.length, maleOnly, femaleOnly, both, noCourse };
  }, [teachers, teacherCourseMap, teacherScopeMap]);

  const scopeBadge = (scope?: GenderScope | '', hasCourse?: boolean) => {
    if (!hasCourse) {
      return (
        <span className="inline-flex items-center rounded-md border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground">
          No Course
        </span>
      );
    }
    if (!scope) {
      return (
        <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
          Not set — 0 students
        </span>
      );
    }
    if (scope === 'Male') {
      return (
        <span className="inline-flex items-center rounded-md bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
          Only Male
        </span>
      );
    }
    if (scope === 'Female') {
      return (
        <span className="inline-flex items-center rounded-md bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-800">
          Only Female
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
        Both (M + F)
      </span>
    );
  };

  const applyCourseAssignment = async (teacherId: string) => {
    const courseId = selectedCourseIds[0] || null;
    const scope = courseId && genderScope ? (genderScope as GenderScope) : null;
    try {
      await setTeacherCourseAssignment(teacherId, courseId, scope);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('CONFLICT:') || /already|overlapping/i.test(msg)) {
        const ok = confirm(
          'Another teacher already covers this class gender for the same course.\n\n' +
            'OK = auto-adjust them (e.g. Both → opposite gender, or remove duplicate).\n' +
            'Cancel = keep current assignments and abort.',
        );
        if (!ok) throw err;
        await setTeacherCourseAssignment(teacherId, courseId, scope, { resolveConflicts: true });
        return;
      }
      throw err;
    }
  };

  const resolveCreatePassword = (data: TeacherForm) => {
    if (useUsernameAsPassword) return data.username.trim();
    return data.password.trim();
  };

  const validateRequired = (data: TeacherForm, mode: 'add' | 'edit') => {
    const required: Array<[keyof TeacherForm, string]> = [
      ['full_name', 'Trainer Name'],
      ['username', 'User Name'],
      ['email', 'Trainer Email'],
      ['cnic', 'CNIC / Form-B'],
      ['province', 'Province'],
      ['region', 'Region'],
      ['district', 'District'],
      ['city', 'City'],
      ['phone', 'Contact Number'],
    ];
    for (const [key, label] of required) {
      if (!String(data[key] || '').trim()) {
        return `${label} is required.`;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (data.username.trim().length < 3) {
      return 'User Name must be at least 3 characters.';
    }

    if (mode === 'add') {
      const password = resolveCreatePassword(data);
      if (password.length < 6) {
        return 'Password must be at least 6 characters.';
      }
      if (!useUsernameAsPassword && password !== data.confirmPassword.trim()) {
        return 'Password and Confirm Password do not match.';
      }
    }
    return null;
  };

  const teacherPayload = (data: TeacherForm, includeUsername: boolean) => {
    const payload: Record<string, string | null> = {
      cnic: data.cnic.trim(),
      province: data.province.trim(),
      region: data.region.trim(),
      district: data.district.trim(),
      city: data.city.trim(),
      experience: data.experience.trim() || null,
      address: data.address.trim() || null,
      trainer_code: data.trainer_code.trim() || null,
      specialization: data.specialization.trim() || null,
    };
    if (includeUsername) {
      payload.username = data.username.trim();
    }
    return payload;
  };

  const openAdd = () => {
    setForm(emptyForm);
    setUseUsernameAsPassword(false);
    setEditing(null);
    setSelectedCourseIds([]);
    setGenderScope('');
    setShowAddModal(true);
  };

  const openEdit = async (teacher: TeacherRow) => {
    setEditing(teacher);
    setForm({
      full_name: teacher.profiles?.full_name || '',
      username: teacher.username || '',
      email: teacher.profiles?.email || '',
      phone: teacher.profiles?.phone || '',
      cnic: teacher.cnic || '',
      province: teacher.province || '',
      region: teacher.region || '',
      district: teacher.district || '',
      city: teacher.city || '',
      experience: teacher.experience || '',
      address: teacher.address || teacher.profiles?.address || '',
      trainer_code: teacher.trainer_code || '',
      specialization: teacher.specialization || '',
      status: teacher.profiles?.status || 'Approved',
      password: '',
      confirmPassword: '',
    });
    setSelectedCourseIds(teacherCourseMap[teacher.id] ?? []);
    setGenderScope(teacherScopeMap[teacher.id] || (teacherCourseMap[teacher.id]?.[0] ? 'Both' : ''));
    setShowAddModal(false);

    const withScope = await supabase
      .from('teacher_courses')
      .select('course_id, gender_scope')
      .eq('teacher_id', teacher.id);
    if (withScope.error) {
      const { data } = await supabase
        .from('teacher_courses')
        .select('course_id')
        .eq('teacher_id', teacher.id);
      setSelectedCourseIds((data ?? []).map((r) => r.course_id));
      setGenderScope((data ?? []).length ? 'Both' : '');
    } else {
      setSelectedCourseIds((withScope.data ?? []).map((r) => r.course_id));
      const scope = withScope.data?.[0]?.gender_scope;
      setGenderScope(
        scope === 'Male' || scope === 'Female' || scope === 'Both' ? scope : '',
      );
    }
  };

  const openResetPassword = (teacher: TeacherRow) => {
    setResetTarget(teacher);
    setResetPassword('');
    setResetConfirm('');
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (resetPassword !== resetConfirm) {
      setMessage({ type: 'error', text: 'Password and Confirm Password do not match.' });
      return;
    }

    setResetting(true);
    setMessage(null);
    try {
      await adminSetUserPassword(resetTarget.profiles.id, resetPassword);
      setMessage({
        type: 'success',
        text: `Password updated for ${resetTarget.profiles.full_name}.`,
      });
      setResetTarget(null);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Password reset failed. Deploy edge function admin-set-password.',
      });
    } finally {
      setResetting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const validationError = validateRequired(form, 'edit');
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }
    if (selectedCourseIds[0] && !genderScope) {
      // Allowed: course without gender → teacher sees 0 students
    }

    setSaving(true);
    setMessage(null);

    const profileId = editing.profiles.id;
    const nextEmail = form.email.trim().toLowerCase();
    const prevEmail = (editing.profiles.email || '').trim().toLowerCase();
    const emailChanged = canEditTeacherCredentials && nextEmail && nextEmail !== prevEmail;

    const profileUpdate: Record<string, string | null> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      status: canChangeTeacherStatus
        ? form.status
        : (editing.profiles?.status ?? 'Pending'),
    };
    if (canEditTeacherCredentials) {
      profileUpdate.email = nextEmail;
    }

    const [{ error: profileError }, { error: teacherError }] = await Promise.all([
      supabase.from('profiles').update(profileUpdate).eq('id', profileId),
      supabase
        .from('teachers')
        .update(teacherPayload(form, canEditTeacherCredentials))
        .eq('id', editing.id),
    ]);

    if (profileError || teacherError) {
      setMessage({
        type: 'error',
        text: profileError?.message || teacherError?.message || 'Update failed',
      });
      setSaving(false);
      return;
    }

    if (emailChanged) {
      try {
        await adminSetUserEmail(profileId, nextEmail);
      } catch (err: any) {
        setMessage({
          type: 'error',
          text:
            err?.message ||
            'Teacher saved, but login email update failed. Redeploy admin-set-password.',
        });
        setSaving(false);
        await fetchTeachers();
        return;
      }
    }

    try {
      await applyCourseAssignment(editing.id);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Teacher saved, but course assignment failed. Run allow_null_teacher_gender_scope.sql if needed.',
      });
      setSaving(false);
      return;
    }

    setMessage({ type: 'success', text: 'Teacher updated successfully.' });
    setEditing(null);
    setSaving(false);
    await fetchTeachers();
  };

  const setStatus = async (
    teacher: TeacherRow,
    status: 'Approved' | 'Suspended' | 'Pending' | 'Rejected',
  ) => {
    if (!canChangeTeacherStatus) {
      setMessage({ type: 'error', text: 'Only Super Admin can approve/reject/suspend teachers.' });
      return;
    }
    const profileId = teacher.profiles?.id;
    if (!profileId) return;
    if (teacher.profiles.status === status) return;
    if (!confirm(`Change status of ${teacher.profiles.full_name} to ${status}?`)) return;

    const { error } = await supabase.from('profiles').update({ status }).eq('id', profileId);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: `Teacher status set to ${status}.` });
    await fetchTeachers();
  };

  const deleteTeacher = async (teacher: TeacherRow) => {
    if (!canDeleteTeacher) {
      setMessage({ type: 'error', text: 'Only Super Admin can delete teachers.' });
      return;
    }
    const name = teacher.profiles?.full_name || teacher.username || 'this teacher';
    if (
      !confirm(
        `Delete teacher "${name}"?\n\nThis removes their teacher record and suspends the account. Auth login may still exist.`,
      )
    ) {
      return;
    }

    const profileId = teacher.profiles?.id;
    await supabase.from('teacher_courses').delete().eq('teacher_id', teacher.id);
    const { error: delError } = await supabase.from('teachers').delete().eq('id', teacher.id);
    if (delError) {
      setMessage({ type: 'error', text: delError.message });
      return;
    }
    if (profileId) {
      await supabase.from('profiles').update({ status: 'Suspended' }).eq('id', profileId);
    }
    setMessage({ type: 'success', text: 'Teacher deleted and account suspended.' });
    await fetchTeachers();
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const validationError = validateRequired(form, 'add');
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }
    if (selectedCourseIds[0] && !genderScope) {
      // Allowed — Not set means 0 students until gender chosen
    }

    if (!teacherRoleId) {
      setMessage({ type: 'error', text: 'Teacher role not found in database.' });
      return;
    }

    setSaving(true);
    const password = resolveCreatePassword(form);

    try {
      const ephemeral = createEphemeralAuthClient();
      const { data: authData, error: signUpError } = await ephemeral.auth.signUp({
        email: form.email.trim(),
        password,
        options: {
          data: {
            full_name: form.full_name.trim(),
            role: 'Teacher',
            username: form.username.trim(),
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error(
          'Teacher account was not created. Check email confirmation settings in Supabase Auth.',
        );
      }

      await new Promise((r) => setTimeout(r, 800));

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .limit(1);

      const profilePatch = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        role_id: teacherRoleId,
        status: canChangeTeacherStatus ? 'Approved' : 'Pending',
      };

      if (existingProfile?.[0]) {
        const { error } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('profiles').insert({ id: userId, ...profilePatch });
        if (error) throw new Error(error.message);
      }

      await ensureTeacherRow(userId, form.specialization.trim() || 'General');

      const { error: teacherUpdateError } = await supabase
        .from('teachers')
        .update(teacherPayload(form, true))
        .eq('profile_id', userId);

      if (teacherUpdateError) throw new Error(teacherUpdateError.message);

      const { data: teacherRows } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', userId)
        .limit(1);

      if (teacherRows?.[0]?.id) {
        await applyCourseAssignment(teacherRows[0].id);
      }

      setMessage({
        type: 'success',
        text: canChangeTeacherStatus
          ? `Teacher "${form.full_name.trim()}" added and activated. Login email: ${form.email.trim()} (password set by admin).`
          : `Teacher "${form.full_name.trim()}" added. Approval pending by Super Admin. Login email: ${form.email.trim()} (password set by admin).`,
      });
      setForm(emptyForm);
      setUseUsernameAsPassword(false);
      setShowAddModal(false);
      await fetchTeachers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to add teacher.' });
    } finally {
      setSaving(false);
    }
  };

  const syncMissingRows = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      if (!teacherRoleId) {
        setMessage({ type: 'error', text: 'Teacher role not found.' });
        setSyncing(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('role_id', teacherRoleId);

      for (const profile of profiles ?? []) {
        await ensureTeacherRow(profile.id);
      }

      // Sheet-based assignments from D:\BanoQabil\students filenames/trainers
      // (UI sync only creates missing teacher rows; full sheet sync via assign_teachers_from_sheets.mjs)
      setMessage({
        type: 'success',
        text: 'Teacher rows synced. Use “Assign from Sheets” or run assign_teachers_from_sheets.mjs for course + Male/Female.',
      });
      await fetchTeachers();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Sync failed (check RLS insert policy on teachers).',
      });
    } finally {
      setSyncing(false);
    }
  };

  const assignFromSheets = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      // Built-in map from students/*.xlsx trainers (must match seed TRAINER_EMAIL_MAP)
      const PLAN: Array<{ email: string; course: string; scope: GenderScope }> = [
        { email: 'zunairat69@gmail.com', course: 'Graphic Designing', scope: 'Female' },
        { email: 'qasimlibra28@gmail.com', course: 'Graphic Designing', scope: 'Male' },
        { email: 'hnaeemabbas1@gmail.com', course: 'Digital Marketing', scope: 'Both' },
        { email: 'abdullahwale@gmail.com', course: 'Essential of AI', scope: 'Male' },
        { email: 'ashmiramajeed14@gmail.com', course: 'Essential of AI', scope: 'Female' },
        { email: 'sajjadkhanggg@gmail.com', course: 'Computer Information & Technology', scope: 'Both' },
      ];

      const courseByName = new Map(courses.map((c) => [c.name.toLowerCase(), c]));
      const teachersByEmail = new Map(
        teachers.map((t) => [String(t.profiles?.email || '').toLowerCase(), t]),
      );

      // Clear ALL teacher courses first, then apply sheet plan (unnamed → No Course)
      for (const t of teachers) {
        await setTeacherCourseAssignment(t.id, null, null);
      }

      for (const row of PLAN) {
        const teacher = teachersByEmail.get(row.email.toLowerCase());
        const course = courseByName.get(row.course.toLowerCase());
        if (!teacher) {
          console.warn('Teacher not in DB:', row.email);
          continue;
        }
        if (!course) {
          console.warn('Course not in DB:', row.course);
          continue;
        }
        await setTeacherCourseAssignment(teacher.id, course.id, row.scope);
      }

      setMessage({
        type: 'success',
        text: 'Assigned courses from Excel sheets (Male/Female/Both). Teachers not in sheets have No Course.',
      });
      await fetchTeachers();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Sheet assign failed. Run add_teacher_gender_scope.sql in Supabase first.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const statusBadgeClass = (status: string | null) => {
    if (status === 'Approved') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
    if (status === 'Suspended' || status === 'Rejected') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  };

  const renderFormFields = (mode: 'add' | 'edit') => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel required>Trainer Name</FieldLabel>
          <Input
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>User Name</FieldLabel>
          <Input
            value={form.username}
            onChange={(e) => {
              setField('username', e.target.value);
              if (useUsernameAsPassword && mode === 'add') {
                setField('password', e.target.value);
                setField('confirmPassword', e.target.value);
              }
            }}
            placeholder="e.g. ashmira.majeed"
            required
            disabled={mode === 'edit' && !canEditTeacherCredentials}
          />
          {mode === 'edit' && !canEditTeacherCredentials ? (
            <p className="text-xs text-muted-foreground">Only Super Admin can edit username.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <FieldLabel required>Trainer Email Address</FieldLabel>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="email@example.com"
            required
            disabled={mode === 'edit' && !canEditTeacherCredentials}
          />
          {mode === 'edit' && !canEditTeacherCredentials ? (
            <p className="text-xs text-muted-foreground">Only Super Admin can edit email.</p>
          ) : null}
        </div>

        {mode === 'add' && (
          <>
            <div className="sm:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <input
                id="use-username-password"
                type="checkbox"
                className="h-4 w-4"
                checked={useUsernameAsPassword}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseUsernameAsPassword(checked);
                  if (checked) {
                    setField('password', form.username);
                    setField('confirmPassword', form.username);
                  } else {
                    setField('password', '');
                    setField('confirmPassword', '');
                  }
                }}
              />
              <label htmlFor="use-username-password" className="text-sm cursor-pointer">
                Use User Name as Password
              </label>
            </div>
            <div className="space-y-2">
              <FieldLabel required>Password</FieldLabel>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Min 6 characters"
                required={!useUsernameAsPassword}
                disabled={useUsernameAsPassword}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel required>Confirm Password</FieldLabel>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                required={!useUsernameAsPassword}
                disabled={useUsernameAsPassword}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <FieldLabel required>CNIC or Form-B</FieldLabel>
          <Input
            value={form.cnic}
            onChange={(e) => setField('cnic', e.target.value)}
            placeholder="Without dashes"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>Contact Number</FieldLabel>
          <Input
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="03XXXXXXXXX"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>Province</FieldLabel>
          <Input
            value={form.province}
            onChange={(e) => setField('province', e.target.value)}
            placeholder="Punjab"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>Region</FieldLabel>
          <Input
            value={form.region}
            onChange={(e) => setField('region', e.target.value)}
            placeholder="South Punjab"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>District</FieldLabel>
          <Input
            value={form.district}
            onChange={(e) => setField('district', e.target.value)}
            placeholder="Vehari"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>City</FieldLabel>
          <Input
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Vehari"
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Experience</FieldLabel>
          <Input
            value={form.experience}
            onChange={(e) => setField('experience', e.target.value)}
            placeholder="e.g. 6 Years"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Specialization</FieldLabel>
          <Input
            value={form.specialization}
            onChange={(e) => setField('specialization', e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Trainer Code</FieldLabel>
          <Input
            value={form.trainer_code}
            onChange={(e) => setField('trainer_code', e.target.value)}
            placeholder="Optional code / ID"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel>Trainer Address</FieldLabel>
          <textarea
            className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Full address"
          />
        </div>
        {mode === 'edit' && canChangeTeacherStatus && (
          <div className="space-y-2">
            <FieldLabel>Status</FieldLabel>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        )}
        <div className="sm:col-span-2">{coursePicker}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manage Teachers</h1>
          <p className="text-muted-foreground mt-1">
            {canChangeTeacherStatus
              ? 'All teachers — edit username/email, change status, or delete (Super Admin).'
              : 'Course + who they teach (Male / Female / Both). Teacher status is managed by Super Admin.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={syncMissingRows} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Records
          </Button>
          <Button variant="outline" className="gap-2" onClick={assignFromSheets} disabled={syncing}>
            <UserCheck className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Assign from Sheets
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Teacher
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Teachers</p>
            <p className="text-2xl font-bold mt-1">{teacherStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-sky-700 uppercase tracking-wide font-medium">Only Male</p>
            <p className="text-2xl font-bold mt-1 text-sky-800">{teacherStats.maleOnly}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-pink-700 uppercase tracking-wide font-medium">Only Female</p>
            <p className="text-2xl font-bold mt-1 text-pink-800">{teacherStats.femaleOnly}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-violet-700 uppercase tracking-wide font-medium">Both</p>
            <p className="text-2xl font-bold mt-1 text-violet-800">{teacherStats.both}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">No Course</p>
            <p className="text-2xl font-bold mt-1">{teacherStats.noCourse}</p>
          </CardContent>
        </Card>
      </div>

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap gap-3 items-center justify-between bg-muted/20">
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, username, city..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as typeof genderFilter)}
              >
                <option value="All">All Classes</option>
                <option value="Male">Only Male</option>
                <option value="Female">Only Female</option>
                <option value="Both">Both</option>
                <option value="None">No Course</option>
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
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">SR#</th>
                  <th className="px-4 py-3.5 font-semibold">Teacher</th>
                  <th className="px-4 py-3.5 font-semibold">Contact</th>
                  <th className="px-4 py-3.5 font-semibold">City</th>
                  <th className="px-4 py-3.5 font-semibold">Course</th>
                  <th className="px-4 py-3.5 font-semibold">Teaches</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No teachers found</p>
                      <Button className="mt-4 gap-2" onClick={openAdd}>
                        <Plus className="w-4 h-4" /> Add Teacher
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t, index) => {
                    const courseIds = teacherCourseMap[t.id] ?? [];
                    const courseName = courseIds
                      .map((id) => courses.find((c) => c.id === id)?.name)
                      .filter(Boolean)[0];
                    const hasCourse = courseIds.length > 0;
                    const scope = teacherScopeMap[t.id];
                    const initials = (t.profiles.full_name || '?')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() || '')
                      .join('');

                    return (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4 text-muted-foreground font-medium">{index + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {initials || <GraduationCap className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-semibold leading-tight">{t.profiles.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                @{t.username || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm">{t.profiles.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.profiles.phone || 'No phone'}
                          </p>
                        </td>
                        <td className="px-4 py-4">{t.city || '—'}</td>
                        <td className="px-4 py-4">
                          {courseName ? (
                            <span className="inline-flex max-w-[200px] items-center rounded-md border bg-background px-2.5 py-1 text-xs font-medium">
                              {courseName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No Course</span>
                          )}
                        </td>
                        <td className="px-4 py-4">{scopeBadge(scope, hasCourse)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(
                              t.profiles.status,
                            )}`}
                          >
                            {t.profiles.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-1 items-center flex-wrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => openEdit(t)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reset Password"
                              onClick={() => openResetPassword(t)}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            {canChangeTeacherStatus ? (
                              <select
                                className="h-8 max-w-[120px] rounded-md border bg-background px-2 text-xs"
                                value={t.profiles.status || 'Pending'}
                                title="Change status"
                                onChange={(e) =>
                                  setStatus(
                                    t,
                                    e.target.value as 'Approved' | 'Pending' | 'Suspended' | 'Rejected',
                                  )
                                }
                              >
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            ) : null}
                            {canDeleteTeacher ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="Delete teacher"
                                onClick={() => deleteTeacher(t)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Teacher</h2>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {renderFormFields('edit')}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Add Teacher</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set a password yourself, or tick “Use User Name as Password”.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form onSubmit={handleAddTeacher} className="space-y-4">
                {renderFormFields('add')}
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Fields marked <span className="text-destructive">*</span> are required. Admin
                  chooses the teacher password at create time.
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Teacher'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {resetTarget.profiles.full_name} · {resetTarget.profiles.email}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setResetTarget(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <FieldLabel required>New Password</FieldLabel>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Confirm Password</FieldLabel>
                <Input
                  type="password"
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

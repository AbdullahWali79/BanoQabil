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
  X,
  KeyRound,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Layers,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  cleanBatchDisplayName,
  ensureTeacherRow,
  relationOne,
  setTeacherCourseAssignment,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';

import {
  adminSetUserPassword,
  adminSetUserEmail,
} from '@/lib/adminPassword';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import { toastSuccess, toastError } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { usePermission } from '@/hooks/usePermission';
import { CNIC_LENGTH, sanitizeCnicInput, validateCnic, normalizeCnic } from '@/lib/cnic';
import {
  TRAINER_CODE_LENGTH,
  generateUniqueTrainerCode,
  isTrainerCodeTaken,
  isUsernameTaken,
  isValidTrainerCode,
  validateTrainerCodeFormat,
} from '@/lib/trainerCode';
import {
  getCities,
  getDistricts,
  getProvinces,
  getRegions,
  withCurrentOption,
} from '@/lib/pakistanLocations';

const selectClassName =
  'h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50';

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
  const { can: canPerm, denyMessage } = usePermission();
  const canAssignCourses = canPerm('can_assign_teachers');
  const canResetPasswords = canPerm('can_reset_passwords');

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Approved' | 'Suspended' | 'Pending' | 'Rejected'
  >('All');
  const [genderFilter, setGenderFilter] = useState<'All' | GenderScope | 'None'>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [viewing, setViewing] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherRoleId, setTeacherRoleId] = useState<string | null>(null);
  const [useTrainerCodeAsPassword, setUseTrainerCodeAsPassword] = useState(true);
  const [resetTarget, setResetTarget] = useState<TeacherRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [generatingTrainerCode, setGeneratingTrainerCode] = useState(false);
  const [trainerCodeCheck, setTrainerCodeCheck] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [usernameCheck, setUsernameCheck] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [genderScope, setGenderScope] = useState<GenderScope | ''>('');
  const [teacherCourseMap, setTeacherCourseMap] = useState<Record<string, string[]>>({});
  const [teacherScopeMap, setTeacherScopeMap] = useState<Record<string, GenderScope | undefined>>({});

  type BatchOption = {
    id: string;
    name: string;
    course_id: string | null;
    teacher_id: string | null;
    timing: string | null;
  };

  const [courseBatches, setCourseBatches] = useState<BatchOption[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const fetchBatchesForCourse = async (courseId: string, currentTeacherId?: string) => {
    if (!courseId) {
      setCourseBatches([]);
      setSelectedBatchIds([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, course_id, teacher_id, timing')
        .eq('course_id', courseId)
        .order('name');
      if (!error && data) {
        setCourseBatches(data as BatchOption[]);
        if (currentTeacherId) {
          const assigned = (data as BatchOption[])
            .filter((b) => b.teacher_id === currentTeacherId)
            .map((b) => b.id);
          setSelectedBatchIds(assigned);
        } else {
          setSelectedBatchIds([]);
        }
      }
    } catch (err) {
      console.error('Failed to load course batches', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSelectCourse = (courseId: string, teacherId?: string) => {
    if (!courseId) {
      setSelectedCourseIds([]);
      setGenderScope('');
      setCourseBatches([]);
      setSelectedBatchIds([]);
    } else {
      setSelectedCourseIds([courseId]);
      if (!genderScope) setGenderScope('Both');
      void fetchBatchesForCourse(courseId, teacherId ?? editing?.id);
    }
  };

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    );
  };

  const selectAllBatches = () => {
    setSelectedBatchIds(courseBatches.map((b) => b.id));
  };

  const deselectAllBatches = () => {
    setSelectedBatchIds([]);
  };

  const syncTeacherBatches = async (teacherId: string, courseId: string | null) => {
    if (!courseId) {
      await supabase.from('batches').update({ teacher_id: null }).eq('teacher_id', teacherId);
      return;
    }

    if (selectedBatchIds.length > 0) {
      await supabase
        .from('batches')
        .update({ teacher_id: teacherId })
        .in('id', selectedBatchIds);
    }

    const unselectedIds = courseBatches
      .filter((b) => !selectedBatchIds.includes(b.id) && b.teacher_id === teacherId)
      .map((b) => b.id);

    if (unselectedIds.length > 0) {
      await supabase
        .from('batches')
        .update({ teacher_id: null })
        .in('id', unselectedIds);
    }
  };


  const setField = (key: keyof TeacherForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** Province → Region → District → City; clearing a parent resets children. */
  const setLocationField = (
    level: 'province' | 'region' | 'district' | 'city',
    value: string,
  ) => {
    setForm((prev) => {
      if (level === 'province') {
        return { ...prev, province: value, region: '', district: '', city: '' };
      }
      if (level === 'region') {
        return { ...prev, region: value, district: '', city: '' };
      }
      if (level === 'district') {
        return { ...prev, district: value, city: '' };
      }
      return { ...prev, city: value };
    });
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
      toastError(error, 'Failed to load teachers.');
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

  const handleAutoGenerateTrainerCode = async () => {
    setGeneratingTrainerCode(true);
    try {
      const code = await generateUniqueTrainerCode();
      setForm((prev) => ({
        ...prev,
        trainer_code: code,
        ...(useTrainerCodeAsPassword
          ? { password: code, confirmPassword: code }
          : {}),
      }));
    } catch (err: unknown) {
      toastError(err, 'Could not generate ID.');
    } finally {
      setGeneratingTrainerCode(false);
    }
  };

  // Live Trainer Code format + uniqueness
  useEffect(() => {
    if (!editing && !showAddModal) {
      setTrainerCodeCheck({ status: 'idle', message: '' });
      return;
    }
    const raw = form.trainer_code.trim();
    if (!raw) {
      setTrainerCodeCheck({ status: 'idle', message: '' });
      return;
    }
    const formatErr = validateTrainerCodeFormat(raw);
    if (formatErr) {
      setTrainerCodeCheck({ status: 'invalid', message: formatErr });
      return;
    }
    let cancelled = false;
    setTrainerCodeCheck({ status: 'checking', message: 'Checking…' });
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isTrainerCodeTaken(raw, editing?.id ?? null);
        if (cancelled) return;
        setTrainerCodeCheck(
          taken
            ? { status: 'invalid', message: 'Trainer Code already in use.' }
            : { status: 'valid', message: 'Trainer Code is available.' },
        );
      } catch {
        if (!cancelled) {
          setTrainerCodeCheck({ status: 'idle', message: '' });
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.trainer_code, editing, showAddModal]);

  // Live username uniqueness
  useEffect(() => {
    if (!editing && !showAddModal) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }
    const raw = form.username.trim();
    if (!raw) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }
    if (raw.length < 3) {
      setUsernameCheck({ status: 'invalid', message: 'User Name must be at least 3 characters.' });
      return;
    }
    if (editing && !canEditTeacherCredentials) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck({ status: 'checking', message: 'Checking…' });
    const timer = window.setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(raw, editing?.id ?? null);
        if (cancelled) return;
        setUsernameCheck(
          taken
            ? { status: 'invalid', message: 'Username already taken.' }
            : { status: 'valid', message: 'Username is available.' },
        );
      } catch {
        if (!cancelled) setUsernameCheck({ status: 'idle', message: '' });
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.username, editing, showAddModal, canEditTeacherCredentials]);

  const coursePicker = (
    <div className={`space-y-4 ${!canAssignCourses ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="space-y-2">
        <FieldLabel>Assigned Course</FieldLabel>
        <p className="text-xs text-muted-foreground">
          {canAssignCourses
            ? 'Pick one course, or No Course. Same course cannot be given twice for the same gender group.'
            : denyMessage('can_assign_teachers')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 rounded-md border p-3 max-h-48 overflow-y-auto bg-background">
          <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
            <input
              type="radio"
              name="teacher-assigned-course"
              className="h-4 w-4"
              checked={selectedCourseIds.length === 0}
              onChange={() => handleSelectCourse('')}
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
                  onChange={() => handleSelectCourse(course.id)}
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

      {/* Interactive Batches Selection Box */}
      {selectedCourseIds[0] && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 via-background to-muted/20 p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Assigned Batches ({selectedBatchIds.length}/{courseBatches.length} Selected)
              </span>
            </div>
            {courseBatches.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={selectAllBatches}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={deselectAllBatches}
                >
                  Deselect All
                </Button>
              </div>
            )}
          </div>

          {loadingBatches ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading course batches...
            </div>
          ) : courseBatches.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
              No batches found for this course. You can create batches in the <strong>Admin &gt; Courses &amp; Batches</strong> section.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {courseBatches.map((b) => {
                const isChecked = selectedBatchIds.includes(b.id);
                const isOtherTeacher = b.teacher_id && b.teacher_id !== (editing?.id ?? '');
                const cleanName = cleanBatchDisplayName(b.name);
                const gender = b.name.toLowerCase().includes('female') ? 'Female' : b.name.toLowerCase().includes('male') ? 'Male' : 'Both';

                return (
                  <label
                    key={b.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-all ${
                      isChecked
                        ? 'border-blue-500 bg-blue-100/60 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/30'
                        : 'bg-background hover:bg-muted/40 border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isChecked}
                      onChange={() => toggleBatchSelection(b.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {cleanName}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {gender}
                        </span>
                      </div>
                      {b.timing ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          ⏰ {b.timing}
                        </p>
                      ) : null}
                      {isOtherTeacher ? (
                        <p className="text-[10px] text-amber-700 font-medium mt-1">
                          ⚠️ Assigned to another trainer
                        </p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
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
        t.trainer_code?.toLowerCase().includes(q) ||
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
    let approved = 0;
    let pending = 0;
    let suspended = 0;
    let rejected = 0;
    for (const t of teachers) {
      const status = t.profiles?.status || '';
      if (status === 'Approved') approved += 1;
      else if (status === 'Pending') pending += 1;
      else if (status === 'Suspended') suspended += 1;
      else if (status === 'Rejected') rejected += 1;

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
    return {
      total: teachers.length,
      maleOnly,
      femaleOnly,
      both,
      noCourse,
      approved,
      pending,
      suspended,
      rejected,
    };
  }, [teachers, teacherCourseMap, teacherScopeMap]);

  const scopeBadge = (scope?: GenderScope | '', hasCourse?: boolean) => {
    if (!hasCourse) {
      return (
        <span className="inline-flex items-center rounded border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          No Course
        </span>
      );
    }
    if (!scope) {
      return (
        <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          Not set
        </span>
      );
    }
    if (scope === 'Male') {
      return (
        <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
          Only Male
        </span>
      );
    }
    if (scope === 'Female') {
      return (
        <span className="inline-flex items-center rounded bg-pink-100 px-2 py-0.5 text-[11px] font-semibold text-pink-800">
          Only Female
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
        Both
      </span>
    );
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

  const applyCourseAssignment = async (teacherId: string) => {
    if (!canAssignCourses) {
      throw new Error(denyMessage('can_assign_teachers'));
    }
    const courseId = selectedCourseIds[0] || null;
    const scope = courseId && genderScope ? (genderScope as GenderScope) : null;
    try {
      await setTeacherCourseAssignment(teacherId, courseId, scope);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('CONFLICT:') || /already|overlapping/i.test(msg)) {
        const ok = await askConfirm({
          title: 'Course assignment conflict',
          description:
            'Another teacher already covers this class gender for the same course.\n\nContinue to auto-adjust them (e.g. Both → opposite gender, or remove duplicate)?',
          confirmLabel: 'Yes, auto-adjust',
          cancelLabel: 'Cancel',
          tone: 'warning',
        });
        if (!ok) throw err;
        await setTeacherCourseAssignment(teacherId, courseId, scope, { resolveConflicts: true });
        return;
      }
      throw err;
    }
  };

  const resolveCreatePassword = (data: TeacherForm) => {
    if (useTrainerCodeAsPassword) return data.trainer_code.trim();
    return data.password.trim();
  };

  const validateRequired = (data: TeacherForm, mode: 'add' | 'edit') => {
    const required: Array<[keyof TeacherForm, string]> = [
      ['full_name', 'Trainer Name'],
      ['username', 'User Name'],
      ['email', 'Trainer Email'],
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
    const codeErr = validateTrainerCodeFormat(data.trainer_code);
    if (codeErr) return codeErr;
    const cnicError = validateCnic(data.cnic);
    if (cnicError) return cnicError;
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
      if (!useTrainerCodeAsPassword && password !== data.confirmPassword.trim()) {
        return 'Password and Confirm Password do not match.';
      }
    }
    return null;
  };

  const teacherPayload = (data: TeacherForm, includeUsername: boolean) => {
    const payload: Record<string, string | null> = {
      cnic: normalizeCnic(data.cnic),
      province: data.province.trim(),
      region: data.region.trim(),
      district: data.district.trim(),
      city: data.city.trim(),
      experience: data.experience.trim() || null,
      address: data.address.trim() || null,
      trainer_code: data.trainer_code.trim(),
      specialization: data.specialization.trim() || null,
    };
    if (includeUsername) {
      payload.username = data.username.trim();
    }
    return payload;
  };

  const openAdd = () => {
    setForm(emptyForm);
    setUseTrainerCodeAsPassword(true);
    setEditing(null);
    setSelectedCourseIds([]);
    setGenderScope('');
    setCourseBatches([]);
    setSelectedBatchIds([]);
    setTrainerCodeCheck({ status: 'idle', message: '' });
    setUsernameCheck({ status: 'idle', message: '' });
    setShowAddModal(true);
  };

  const openEdit = async (teacher: TeacherRow) => {
    setEditing(teacher);
    setForm({
      full_name: teacher.profiles?.full_name || '',
      username: teacher.username || '',
      email: teacher.profiles?.email || '',
      phone: teacher.profiles?.phone || '',
      cnic: sanitizeCnicInput(teacher.cnic || ''),
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
    setShowAddModal(false);

    const withScope = await supabase
      .from('teacher_courses')
      .select('course_id, gender_scope')
      .eq('teacher_id', teacher.id);

    let assignedCourseId: string | null = null;
    if (withScope.error) {
      const { data } = await supabase
        .from('teacher_courses')
        .select('course_id')
        .eq('teacher_id', teacher.id);
      const cIds = (data ?? []).map((r) => r.course_id);
      setSelectedCourseIds(cIds);
      setGenderScope(cIds.length ? 'Both' : '');
      assignedCourseId = cIds[0] || null;
    } else {
      const cIds = (withScope.data ?? []).map((r) => r.course_id);
      setSelectedCourseIds(cIds);
      const scope = withScope.data?.[0]?.gender_scope;
      setGenderScope(
        scope === 'Male' || scope === 'Female' || scope === 'Both' ? scope : '',
      );
      assignedCourseId = cIds[0] || null;
    }

    if (assignedCourseId) {
      void fetchBatchesForCourse(assignedCourseId, teacher.id);
    } else {
      setCourseBatches([]);
      setSelectedBatchIds([]);
    }
  };


  const openResetPassword = (teacher: TeacherRow) => {
    if (!canResetPasswords) {
      toastError(denyMessage('can_reset_passwords'));
      return;
    }
    setResetTarget(teacher);
    setResetPassword('');
    setResetConfirm('');
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetTarget.profiles.id) {
      toastError('Teacher Auth account id is missing. Cannot reset password.');
      return;
    }
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
      const result = await adminSetUserPassword(resetTarget.profiles.id, resetPassword, {
        hintEmail: resetTarget.profiles.email,
      });
      const loginEmail = result.loginEmail || resetTarget.profiles.email || 'their email';
      toastSuccess(
        result.emailSynced
          ? `Password updated. Login with ${loginEmail} (Auth email was synced).`
          : `Password updated. Teacher must login with email: ${loginEmail}`,
      );
      setResetPassword('');
      setResetConfirm('');
      setResetTarget(null);
    } catch (err: unknown) {
      toastError(err, 'Password update failed.');
    } finally {
      setResetting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const validationError = validateRequired(form, 'edit');
    if (validationError) {
      toastError(validationError);
      return;
    }
    if (trainerCodeCheck.status === 'invalid') {
      toastError(trainerCodeCheck.message || 'Invalid Trainer Code.');
      return;
    }
    if (canEditTeacherCredentials && usernameCheck.status === 'invalid') {
      toastError(usernameCheck.message || 'Username already taken.');
      return;
    }

    const codeTaken = await isTrainerCodeTaken(form.trainer_code.trim(), editing.id);
    if (codeTaken) {
      toastError('Trainer Code already in use.');
      return;
    }
    if (canEditTeacherCredentials) {
      const userTaken = await isUsernameTaken(form.username.trim(), editing.id);
      if (userTaken) {
        toastError('Username already taken.');
        return;
      }
    }

    if (selectedCourseIds[0] && !genderScope) {
      // Allowed: course without gender → teacher sees 0 students
    }

    setSaving(true);

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
      toastError(profileError || teacherError, 'Update failed');
      setSaving(false);
      return;
    }

    if (emailChanged) {
      try {
        await adminSetUserEmail(profileId, nextEmail);
      } catch (err: unknown) {
        toastError(err, 'Email update failed.');
        setSaving(false);
        await fetchTeachers();
        return;
      }
    }

    try {
      await applyCourseAssignment(editing.id);
      await syncTeacherBatches(editing.id, selectedCourseIds[0] || null);
    } catch (err: unknown) {
      toastError(err, 'Course assignment failed.');
      setSaving(false);
      return;
    }


    toastSuccess('Teacher updated.');
    setEditing(null);
    setSaving(false);
    await fetchTeachers();
  };

  const setStatus = async (
    teacher: TeacherRow,
    status: 'Approved' | 'Suspended' | 'Pending' | 'Rejected',
  ) => {
    if (!canChangeTeacherStatus) {
      toastError('Only Super Admin can do this.');
      return;
    }
    const profileId = teacher.profiles?.id;
    if (!profileId) return;
    if (teacher.profiles.status === status) return;
    const ok = await askConfirm({
      title: 'Change teacher status?',
      description: `Are you sure you want to set "${teacher.profiles.full_name}" to ${status}?`,
      confirmLabel: `Yes, set ${status}`,
      cancelLabel: 'Cancel',
      tone: status === 'Approved' ? 'default' : 'warning',
    });
    if (!ok) return;

    const { error } = await supabase.from('profiles').update({ status }).eq('id', profileId);
    if (error) {
      toastError(error, 'Failed to update status.');
      return;
    }
    toastSuccess(`Teacher status set to ${status}.`);
    await fetchTeachers();
  };

  const deleteTeacher = async (teacher: TeacherRow) => {
    if (!canDeleteTeacher) {
      toastError('Only Super Admin can do this.');
      return;
    }
    const name = teacher.profiles?.full_name || teacher.username || 'this teacher';
    const ok = await askConfirm({
      title: 'Delete teacher record?',
      description: `Are you sure you want to remove "${name}"?\n\nThis deletes their teacher record and suspends the account. Auth login may still exist.`,
      confirmLabel: 'Yes, delete teacher',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const profileId = teacher.profiles?.id;
    await supabase.from('teacher_courses').delete().eq('teacher_id', teacher.id);
    const { error: delError } = await supabase.from('teachers').delete().eq('id', teacher.id);
    if (delError) {
      toastError(delError, 'Failed to delete teacher.');
      return;
    }
    if (profileId) {
      await supabase.from('profiles').update({ status: 'Suspended' }).eq('id', profileId);
    }
    toastSuccess('Teacher removed.');
    await fetchTeachers();
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateRequired(form, 'add');
    if (validationError) {
      toastError(validationError);
      return;
    }
    if (trainerCodeCheck.status === 'invalid') {
      toastError(trainerCodeCheck.message || 'Invalid Trainer Code.');
      return;
    }
    if (usernameCheck.status === 'invalid') {
      toastError(usernameCheck.message || 'Username already taken.');
      return;
    }
    if (selectedCourseIds[0] && !genderScope) {
      // Allowed — Not set means 0 students until gender chosen
    }

    if (!teacherRoleId) {
      toastError('Teacher role not found.');
      return;
    }

    const codeTaken = await isTrainerCodeTaken(form.trainer_code.trim());
    if (codeTaken) {
      toastError('Trainer Code already in use.');
      return;
    }
    const userTaken = await isUsernameTaken(form.username.trim());
    if (userTaken) {
      toastError('Username already taken.');
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
            trainer_code: form.trainer_code.trim(),
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
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profiles').insert({ id: userId, ...profilePatch });
        if (error) throw error;
      }

      // Single insert/update with full payload (incl. username) — avoids Admin RLS
      // failure when bare insert then username update was blocked.
      const teacherId = await ensureTeacherRow(
        userId,
        form.specialization.trim() || 'General',
        teacherPayload(form, true),
      );

      if (teacherId) {
        await applyCourseAssignment(teacherId);
        await syncTeacherBatches(teacherId, selectedCourseIds[0] || null);
      }


      toastSuccess(
        canChangeTeacherStatus ? 'Teacher added.' : 'Teacher added (pending approval).',
      );
      setForm(emptyForm);
      setUseTrainerCodeAsPassword(true);
      setShowAddModal(false);
      await fetchTeachers();
    } catch (err: unknown) {
      toastError(err, 'Failed to add teacher.');
    } finally {
      setSaving(false);
    }
  };

  const syncMissingRows = async () => {
    setSyncing(true);
    try {
      if (!teacherRoleId) {
        toastError('Teacher role not found.');
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

      const { data: teacherList, error: listError } = await supabase
        .from('teachers')
        .select('id, profile_id, trainer_code');

      if (listError) throw listError;

      let assigned = 0;
      let passwordSet = 0;
      for (const t of teacherList ?? []) {
        let code = isValidTrainerCode(t.trainer_code)
          ? String(t.trainer_code).trim()
          : '';

        if (!code) {
          code = await generateUniqueTrainerCode();
          const { error } = await supabase
            .from('teachers')
            .update({ trainer_code: code })
            .eq('id', t.id);
          if (error) throw error;
          assigned += 1;
        }

        if (t.profile_id && code) {
          try {
            await adminSetUserPassword(t.profile_id, code);
            passwordSet += 1;
          } catch (err) {
            console.warn('Could not set password for teacher', t.profile_id, err);
          }
        }
      }

      if (assigned > 0 || passwordSet > 0) {
        toastSuccess(
          assigned > 0
            ? `Assigned ${assigned} IDs · ${passwordSet} passwords.`
            : `Passwords set for ${passwordSet} teachers.`,
        );
      } else {
        toastSuccess('Teachers synced.');
      }
      await fetchTeachers();
    } catch (err: unknown) {
      toastError(err, 'Sync failed.');
    } finally {
      setSyncing(false);
    }
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
            onChange={(e) => setField('username', e.target.value)}
            placeholder="e.g. ashmira.majeed"
            required
            disabled={mode === 'edit' && !canEditTeacherCredentials}
            aria-invalid={usernameCheck.status === 'invalid'}
          />
          {mode === 'edit' && !canEditTeacherCredentials ? (
            <p className="text-xs text-muted-foreground">Only Super Admin can edit username.</p>
          ) : usernameCheck.status !== 'idle' ? (
            <p
              className={`flex items-center gap-1.5 text-xs ${
                usernameCheck.status === 'valid'
                  ? 'text-green-600'
                  : usernameCheck.status === 'checking'
                    ? 'text-muted-foreground'
                    : 'text-destructive'
              }`}
            >
              {usernameCheck.status === 'valid' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : usernameCheck.status === 'checking' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {usernameCheck.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Must be unique</p>
          )}
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

        <div className="space-y-2 sm:col-span-2">
          <FieldLabel required>Trainer Code</FieldLabel>
          <div className="flex gap-1.5">
            <Input
              value={form.trainer_code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, TRAINER_CODE_LENGTH);
                setField('trainer_code', digits);
                if (useTrainerCodeAsPassword && mode === 'add') {
                  setField('password', digits);
                  setField('confirmPassword', digits);
                }
              }}
              placeholder={`7 digits e.g. 5210001`}
              required
              inputMode="numeric"
              maxLength={TRAINER_CODE_LENGTH}
              className="font-mono"
              aria-invalid={trainerCodeCheck.status === 'invalid'}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={generatingTrainerCode}
              onClick={() => void handleAutoGenerateTrainerCode()}
              title="Auto Generate"
              aria-label="Auto Generate Trainer Code"
            >
              {generatingTrainerCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
          {trainerCodeCheck.status !== 'idle' ? (
            <p
              className={`flex items-center gap-1.5 text-xs ${
                trainerCodeCheck.status === 'valid'
                  ? 'text-green-600'
                  : trainerCodeCheck.status === 'checking'
                    ? 'text-muted-foreground'
                    : 'text-destructive'
              }`}
            >
              {trainerCodeCheck.status === 'valid' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : trainerCodeCheck.status === 'checking' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {trainerCodeCheck.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Exactly {TRAINER_CODE_LENGTH} digits · must be unique · click ✨ to generate
            </p>
          )}
        </div>

        {mode === 'add' && (
          <>
            <div className="sm:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <input
                id="use-trainer-code-password"
                type="checkbox"
                className="h-4 w-4"
                checked={useTrainerCodeAsPassword}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseTrainerCodeAsPassword(checked);
                  if (checked) {
                    setField('password', form.trainer_code);
                    setField('confirmPassword', form.trainer_code);
                  } else {
                    setField('password', '');
                    setField('confirmPassword', '');
                  }
                }}
              />
              <label htmlFor="use-trainer-code-password" className="text-sm cursor-pointer">
                Use Trainer Code as Password
              </label>
            </div>
            <div className="space-y-2">
              <FieldLabel required={!useTrainerCodeAsPassword}>Password</FieldLabel>
              <Input
                type="password"
                value={useTrainerCodeAsPassword ? form.trainer_code : form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Min 6 characters"
                required={!useTrainerCodeAsPassword}
                disabled={useTrainerCodeAsPassword}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel required={!useTrainerCodeAsPassword}>Confirm Password</FieldLabel>
              <Input
                type="password"
                value={useTrainerCodeAsPassword ? form.trainer_code : form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                required={!useTrainerCodeAsPassword}
                disabled={useTrainerCodeAsPassword}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <FieldLabel required>CNIC or Form-B</FieldLabel>
          <Input
            value={form.cnic}
            onChange={(e) => setField('cnic', sanitizeCnicInput(e.target.value))}
            placeholder={`${CNIC_LENGTH} digits (no dashes)`}
            required
            inputMode="numeric"
            maxLength={CNIC_LENGTH}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Exactly {CNIC_LENGTH} digits · {form.cnic.length}/{CNIC_LENGTH}
          </p>
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
          <select
            className={selectClassName}
            value={form.province}
            onChange={(e) => setLocationField('province', e.target.value)}
            required
          >
            <option value="">Select province</option>
            {withCurrentOption(getProvinces(), form.province).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel required>Region</FieldLabel>
          <select
            className={selectClassName}
            value={form.region}
            onChange={(e) => setLocationField('region', e.target.value)}
            required
            disabled={!form.province}
          >
            <option value="">
              {form.province ? 'Select region' : 'Select province first'}
            </option>
            {withCurrentOption(getRegions(form.province), form.region).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel required>District</FieldLabel>
          <select
            className={selectClassName}
            value={form.district}
            onChange={(e) => setLocationField('district', e.target.value)}
            required
            disabled={!form.province || !form.region}
          >
            <option value="">
              {form.region ? 'Select district' : 'Select region first'}
            </option>
            {withCurrentOption(
              getDistricts(form.province, form.region),
              form.district,
            ).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel required>City</FieldLabel>
          <select
            className={selectClassName}
            value={form.city}
            onChange={(e) => setLocationField('city', e.target.value)}
            required
            disabled={!form.province || !form.region || !form.district}
          >
            <option value="">
              {form.district ? 'Select city' : 'Select district first'}
            </option>
            {withCurrentOption(
              getCities(form.province, form.region, form.district),
              form.city,
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manage Teachers</h1>
          <p className="mt-1 text-muted-foreground">
            {canChangeTeacherStatus
              ? 'View, filter, and manage teachers — approve, edit, or assign courses.'
              : 'View teachers and assign courses. Status is managed by Super Admin.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={syncMissingRows}
            disabled={syncing}
            title="Assign missing Trainer Codes and set passwords to those IDs"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Records
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Teacher
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-l-4 border-l-slate-400 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{teacherStats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Approved</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-800">{teacherStats.approved}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-800">{teacherStats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-300 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">No Course</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{teacherStats.noCourse}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-3 border-b bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'All' as const, label: 'All', count: teacherStats.total },
                  { key: 'Male' as const, label: 'Male', count: teacherStats.maleOnly },
                  { key: 'Female' as const, label: 'Female', count: teacherStats.femaleOnly },
                  { key: 'Both' as const, label: 'Both', count: teacherStats.both },
                  { key: 'None' as const, label: 'No Course', count: teacherStats.noCourse },
                ]
              ).map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant={genderFilter === chip.key ? 'default' : 'outline'}
                  onClick={() => setGenderFilter(chip.key)}
                >
                  {chip.label} ({chip.count})
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                  placeholder="Search name, email, username, code..."
                  className="bg-background pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="All">All Status</option>
                <option value="Approved">Approved ({teacherStats.approved})</option>
                <option value="Pending">Pending ({teacherStats.pending})</option>
                <option value="Suspended">Suspended ({teacherStats.suspended})</option>
                <option value="Rejected">Rejected ({teacherStats.rejected})</option>
              </select>
              <p className="ml-auto text-sm text-muted-foreground">
                {filteredTeachers.length} result(s)
              </p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Teacher</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Course / Class</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No teachers found</p>
                      <Button className="mt-4 gap-2" onClick={openAdd}>
                        <Plus className="h-4 w-4" /> Add Teacher
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
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/25">
                        <td className="px-4 py-3 font-medium text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {t.trainer_code || '—'}
                        </span>
                      </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {initials || 'T'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium leading-tight">
                                {t.profiles.full_name || '—'}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                @{t.username || '—'}
                                {t.city ? ` · ${t.city}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[200px] truncate text-sm">{t.profiles.email || '—'}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t.profiles.phone || 'No phone'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            {courseName ? (
                              <span className="inline-flex max-w-[180px] truncate rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                {courseName}
                        </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">Unassigned</span>
                            )}
                            {scopeBadge(scope, hasCourse)}
                          </div>
                      </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              t.profiles.status,
                            )}`}
                          >
                            {t.profiles.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-col items-stretch gap-1 rounded-lg border bg-background p-0.5 shadow-sm">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="View details"
                                onClick={() => setViewing(t)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit"
                                onClick={() => openEdit(t)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Reset Password"
                                disabled={!canResetPasswords}
                                onClick={() => openResetPassword(t)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              {canDeleteTeacher ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  title="Delete teacher"
                                  onClick={() => deleteTeacher(t)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                            {canChangeTeacherStatus ? (
                              <select
                                className="h-8 w-full rounded-md border-0 bg-transparent px-1 text-center text-xs outline-none"
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

      {/* View Teacher Details */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg border-none max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Teacher Details</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewing.profiles.full_name || '—'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setViewing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(
                    viewing.profiles.status,
                  )}`}
                >
                  {viewing.profiles.status || '—'}
                </span>
                {scopeBadge(
                  teacherScopeMap[viewing.id],
                  (teacherCourseMap[viewing.id] ?? []).length > 0,
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {(
                  [
                    ['Trainer Code', viewing.trainer_code || '—'],
                    ['Username', viewing.username ? `@${viewing.username}` : '—'],
                    ['Email', viewing.profiles.email || '—'],
                    ['Phone', viewing.profiles.phone || '—'],
                    ['CNIC', viewing.cnic || '—'],
                    ['Province', viewing.province || '—'],
                    ['Region', viewing.region || '—'],
                    ['District', viewing.district || '—'],
                    ['City', viewing.city || '—'],
                    ['Experience', viewing.experience || '—'],
                    ['Specialization', viewing.specialization || '—'],
                    [
                      'Course',
                      (teacherCourseMap[viewing.id] ?? [])
                        .map((id) => courses.find((c) => c.id === id)?.name)
                        .filter(Boolean)[0] || 'Unassigned',
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-0.5 font-medium break-all">{value}</p>
                  </div>
                ))}
                <div className="rounded-md border bg-muted/20 px-3 py-2 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Address</p>
                  <p className="mt-0.5 font-medium">
                    {viewing.address || viewing.profiles.address || '—'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setViewing(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const t = viewing;
                    setViewing(null);
                    void openEdit(t);
                  }}
                >
                  Edit Teacher
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl border-2 border-blue-500/20 shadow-2xl bg-card max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md">
                    {editing.profiles.full_name ? editing.profiles.full_name.charAt(0).toUpperCase() : 'T'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">Edit Teacher Profile</h2>
                      {editing.trainer_code ? (
                        <span className="rounded-md bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                          #{editing.trainer_code}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Update contact details, locations, course assignment, and specific batches.
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {renderFormFields('edit')}

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-xs text-muted-foreground italic">
                  Changes take effect immediately upon saving.
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
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
                    Click ✨ Auto Generate to create a unique Trainer Code (used as password).
                  </p>
              </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form onSubmit={handleAddTeacher} className="space-y-4">
                {renderFormFields('add')}
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Fields marked <span className="text-destructive">*</span> are required. Login
                  password defaults to the Trainer Code.
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {resetTarget.profiles.full_name}
                    {resetTarget.profiles.email ? ` · ${resetTarget.profiles.email}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setResetTarget(null);
                    setResetPassword('');
                    setResetConfirm('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form
                className="space-y-4"
                autoComplete="off"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResetPassword();
                }}
              >
                <div className="space-y-2">
                  <FieldLabel required>New Password</FieldLabel>
                  <Input
                    key={`np-${resetTarget.profiles.id}`}
                    type="password"
                    name="bq_teacher_new_password"
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel required>Confirm Password</FieldLabel>
                  <Input
                    key={`cp-${resetTarget.profiles.id}`}
                    type="password"
                    name="bq_teacher_confirm_password"
                    autoComplete="new-password"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={
                      resetting ||
                      resetPassword.length < 6 ||
                      resetPassword !== resetConfirm
                    }
                  >
                    {resetting ? 'Updating...' : 'Set New Password'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setResetTarget(null);
                      setResetPassword('');
                      setResetConfirm('');
                    }}
                    disabled={resetting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

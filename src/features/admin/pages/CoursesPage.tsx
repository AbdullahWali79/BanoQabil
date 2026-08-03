import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastSuccess, toastError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Plus,
  X,
  Users,
  Search,
  Trash2,
  Edit3,
  Layers,
  Clock,
  ChevronDown,
  ChevronUp,
  UserX,
  Filter,
} from 'lucide-react';
import {
  cleanBatchDisplayName,
  relationOne,
  syncTeacherBatchAssignment,
} from '@/features/teacher/utils/teacherData';

type Course = {
  id: string;
  name: string;
  description: string | null;
  initial_fee?: number | null;
  monthly_fee?: number | null;
  is_free?: boolean | null;
};

type TeacherOption = { id: string; name: string };

type Batch = {
  id: string;
  name: string;
  course_id: string | null;
  teacher_id: string | null;
  timing: string | null;
  start_date: string | null;
  end_date: string | null;
  course_name?: string;
  teacher_name?: string;
  student_count?: number;
};

function batchGenderLabel(name: string): 'Female' | 'Male' | 'Both' {
  const n = cleanBatchDisplayName(name).toLowerCase();
  if (/\bfemale\b/.test(n)) return 'Female';
  if (/\bmale\b/.test(n)) return 'Male';
  return 'Both';
}


const SCHEDULE_PRESETS = [
  '09:00 AM - 11:00 AM (Thursday - Friday)',
  '11:00 AM - 01:00 PM (Thursday - Friday)',
  '02:00 PM - 04:00 PM (Thursday - Friday)',
  '04:00 PM - 06:00 PM (Thursday - Friday)',
  '06:00 PM - 08:00 PM (Thursday - Friday)',
  '09:00 AM - 11:00 AM (Monday - Tuesday)',
  '11:00 AM - 01:00 PM (Monday - Tuesday)',
  '02:00 PM - 04:00 PM (Monday - Tuesday)',
  '04:00 PM - 06:00 PM (Monday - Tuesday)',
  '06:00 PM - 08:00 PM (Monday - Tuesday)',
  '09:00 AM - 11:00 AM (Saturday - Sunday)',
  '11:00 AM - 01:00 PM (Saturday - Sunday)',
  '02:00 PM - 04:00 PM (Saturday - Sunday)',
  '04:00 PM - 06:00 PM (Saturday - Sunday)',
  '06:00 PM - 08:00 PM (Saturday - Sunday)',
];


const COMMON_TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
  '06:00 PM - 08:00 PM',
  '08:00 PM - 10:00 PM',
];

const COMMON_DAYS = [
  'Thursday - Friday',
  'Monday - Tuesday',
  'Saturday - Sunday',
  'Mon - Wed - Fri',
  'Tue - Thu - Sat',
  'Friday & Sunday',
  'Everyday',
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [feeFilter, setFeeFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [teacherFilter, setTeacherFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Form states
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingTeacherBatchId, setUpdatingTeacherBatchId] = useState<string | null>(null);

  // Easy Timing Selector states
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  const combineTiming = (slot: string, days: string) => {
    if (!slot && !days) return;
    let result = slot;
    if (days) {
      result = result ? `${result} (${days})` : `(${days})`;
    }
    setBatchForm((f) => ({ ...f, timing: result }));
  };



  // Deletion confirm state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'course' | 'batch';
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    initial_fee: '',
    monthly_fee: '',
    is_free: false,
  });

  const [batchForm, setBatchForm] = useState<{
    name: string;
    course_id: string;
    teacher_id: string;
    timing: string;
    start_date: string;
    end_date: string;
    gender: 'Female' | 'Male' | 'Both';
  }>({
    name: '',
    course_id: '',
    teacher_id: '',
    timing: '',
    start_date: '',
    end_date: '',
    gender: 'Female',
  });


  const [viewStudentsBatchId, setViewStudentsBatchId] = useState<string | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    const [coursesRes, batchesRes, teachersRes] = await Promise.all([
      supabase.from('courses').select('*').order('name'),
      supabase.from('batches').select('*').order('name'),
      supabase.from('teachers').select('id, profile_id, profiles(full_name, status)'),
    ]);

    if (coursesRes.error) toastError(coursesRes.error, 'Failed to load courses.');
    if (batchesRes.error) toastError(batchesRes.error, 'Failed to load batches.');

    const courseRows = (coursesRes.data ?? []) as Course[];
    setCourses(courseRows);

    const courseMap = Object.fromEntries(courseRows.map((c) => [c.id, c.name]));

    const teacherOptions: TeacherOption[] = [];
    const teacherNameById: Record<string, string> = {};
    for (const t of teachersRes.data ?? []) {
      const profile = relationOne((t as any).profiles);
      if (profile?.status && profile.status !== 'Approved') continue;
      const name = profile?.full_name || 'Teacher';
      teacherOptions.push({ id: t.id, name });
      teacherNameById[t.id] = name;
    }
    setTeachers(teacherOptions);

    const batchRows = ((batchesRes.data ?? []) as any[]).map((batch) => ({
      ...batch,
      name: cleanBatchDisplayName(batch.name),
      course_name: batch.course_id ? courseMap[batch.course_id] || 'Unknown course' : 'Unknown course',
      teacher_name: batch.teacher_id
        ? teacherNameById[batch.teacher_id] || 'Assigned'
        : 'Not assigned',
      student_count: 0,
    })) as Batch[];

    if (batchRows.length > 0) {
      const { data: studentRows } = await supabase
        .from('students')
        .select('batch_id')
        .in(
          'batch_id',
          batchRows.map((b) => b.id),
        );
      const counts: Record<string, number> = {};
      for (const s of studentRows ?? []) {
        if (!s.batch_id) continue;
        counts[s.batch_id] = (counts[s.batch_id] || 0) + 1;
      }
      for (const b of batchRows) b.student_count = counts[b.id] || 0;
    }

    setBatches(batchRows);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute summary stats
  const totalCourses = courses.length;
  const totalBatches = batches.length;
  const totalEnrolledStudents = useMemo(
    () => batches.reduce((sum, b) => sum + (b.student_count || 0), 0),
    [batches],
  );
  const unassignedBatchesCount = useMemo(
    () => batches.filter((b) => !b.teacher_id).length,
    [batches],
  );

  // Group batches by course
  const batchesByCourse = useMemo(() => {
    const map: Record<string, Batch[]> = {};
    for (const c of courses) map[c.id] = [];
    for (const b of batches) {
      if (!b.course_id) continue;
      if (!map[b.course_id]) map[b.course_id] = [];
      map[b.course_id].push(b);
    }
    return map;
  }, [courses, batches]);

  // Filtered courses based on search & filters
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Fee filter
      if (feeFilter === 'free' && !course.is_free) return false;
      if (feeFilter === 'paid' && course.is_free) return false;

      const courseBatches = batchesByCourse[course.id] || [];

      // Teacher assignment filter
      if (teacherFilter === 'unassigned') {
        if (!courseBatches.some((b) => !b.teacher_id)) return false;
      } else if (teacherFilter === 'assigned') {
        if (!courseBatches.some((b) => Boolean(b.teacher_id))) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCourse =
          course.name.toLowerCase().includes(q) ||
          (course.description && course.description.toLowerCase().includes(q));

        const matchesAnyBatch = courseBatches.some(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.teacher_name && b.teacher_name.toLowerCase().includes(q)) ||
            (b.timing && b.timing.toLowerCase().includes(q)),
        );

        if (!matchesCourse && !matchesAnyBatch) return false;
      }

      return true;
    });
  }, [courses, batchesByCourse, feeFilter, teacherFilter, searchQuery]);

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourseIds((prev) => ({
      ...prev,
      [courseId]: prev[courseId] === undefined ? false : !prev[courseId],
    }));
  };

  // Course Actions
  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm({
      name: '',
      description: '',
      initial_fee: '',
      monthly_fee: '',
      is_free: false,
    });
    setShowCourseForm(true);
    setShowBatchForm(false);
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      name: course.name,
      description: course.description || '',
      initial_fee: course.initial_fee != null ? String(course.initial_fee) : '',
      monthly_fee: course.monthly_fee != null ? String(course.monthly_fee) : '',
      is_free: Boolean(course.is_free),
    });
    setShowCourseForm(true);
    setShowBatchForm(false);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name.trim()) return;
    setSaving(true);

    const isFree = courseForm.is_free;
    const initialFee = isFree
      ? 0
      : courseForm.initial_fee.trim() === ''
        ? 0
        : Number(courseForm.initial_fee);
    const monthlyFee = isFree
      ? 0
      : courseForm.monthly_fee.trim() === ''
        ? 0
        : Number(courseForm.monthly_fee);

    if (Number.isNaN(initialFee) || Number.isNaN(monthlyFee) || initialFee < 0 || monthlyFee < 0) {
      toastError('Fees must be valid numbers (0 or more).');
      setSaving(false);
      return;
    }

    const payload = {
      name: courseForm.name.trim(),
      description: courseForm.description.trim() || null,
      initial_fee: initialFee,
      monthly_fee: monthlyFee,
      is_free: isFree,
    };

    if (editingCourse) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editingCourse.id);
      if (error) toastError(error, 'Something went wrong.');
      else toastSuccess('Course updated successfully.');
    } else {
      const { error } = await supabase.from('courses').insert(payload);
      if (error) toastError(error, 'Something went wrong.');
      else toastSuccess('Course created successfully.');
    }

    setSaving(false);
    setShowCourseForm(false);
    await fetchData();
  };

  // Batch Actions
  const openCreateBatch = (courseId?: string) => {
    setEditingBatch(null);
    setSelectedSlot('');
    setSelectedDay('');
    setBatchForm({
      name: '',
      course_id: courseId || courses[0]?.id || '',
      teacher_id: '',
      timing: '',
      start_date: '',
      end_date: '',
      gender: 'Female',
    });
    setShowBatchForm(true);
    setShowCourseForm(false);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setSelectedSlot('');
    setSelectedDay('');

    const existingGender = batchGenderLabel(batch.name);
    const rawClean = cleanBatchDisplayName(batch.name);

    setBatchForm({
      name: rawClean,
      course_id: batch.course_id || '',
      teacher_id: batch.teacher_id || '',
      timing: batch.timing || '',
      start_date: batch.start_date || '',
      end_date: batch.end_date || '',
      gender: existingGender,
    });
    setShowBatchForm(true);
    setShowCourseForm(false);
  };

  const saveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.name.trim() || !batchForm.course_id) {
      toastError('Batch name and course are required.');
      return;
    }
    setSaving(true);

    let rawInput = cleanBatchDisplayName(batchForm.name.trim());
    let finalBatchName = rawInput;

    if (batchForm.gender === 'Female') {
      if (/\bmale\b/i.test(rawInput)) {
        finalBatchName = rawInput.replace(/\bmale\b/gi, 'Female');
      } else if (!/\bfemale\b/i.test(rawInput)) {
        finalBatchName = `${rawInput} Female`;
      }
    } else if (batchForm.gender === 'Male') {
      if (/\bfemale\b/i.test(rawInput)) {
        finalBatchName = rawInput.replace(/\bfemale\b/gi, 'Male');
      } else if (!/\bmale\b/i.test(rawInput)) {
        finalBatchName = `${rawInput} Male`;
      }
    } else if (batchForm.gender === 'Both') {
      if (/\bfemale\b|\bmale\b/i.test(rawInput)) {
        finalBatchName = rawInput.replace(/\b(female|male)\b/gi, 'Both');
      } else if (!/\bboth\b|\bco-ed\b/i.test(rawInput)) {
        finalBatchName = `${rawInput} Both`;
      }
    }


    const payload: Record<string, any> = {
      name: finalBatchName,
      course_id: batchForm.course_id,
      teacher_id: batchForm.teacher_id || null,
      timing: batchForm.timing.trim() || null,
    };

    if (batchForm.start_date) payload.start_date = batchForm.start_date;
    if (batchForm.end_date) payload.end_date = batchForm.end_date;

    let { error } = editingBatch
      ? await supabase.from('batches').update(payload).eq('id', editingBatch.id)
      : await supabase.from('batches').insert(payload);

    // Fallback: If DB schema does not have start_date or end_date column
    if (error && /end_date|start_date|column/i.test(error.message)) {
      const fallbackPayload = {
        name: finalBatchName,
        course_id: batchForm.course_id,
        teacher_id: batchForm.teacher_id || null,
        timing: batchForm.timing.trim() || null,
      };

      const fallbackRes = editingBatch
        ? await supabase.from('batches').update(fallbackPayload).eq('id', editingBatch.id)
        : await supabase.from('batches').insert(fallbackPayload);

      error = fallbackRes.error;
    }


    if (error) {
      toastError(error, 'Failed to save batch.');
    } else {
      if (batchForm.teacher_id && batchForm.course_id) {
        await syncTeacherBatchAssignment(batchForm.teacher_id, batchForm.course_id);
      }
      toastSuccess(editingBatch ? 'Batch updated successfully.' : 'Batch created successfully.');
    }

    setSaving(false);
    setShowBatchForm(false);
    await fetchData();
  };


  // Inline Quick Teacher Assignment directly on Batch Row
  const handleInlineTeacherChange = async (batch: Batch, newTeacherId: string) => {
    setUpdatingTeacherBatchId(batch.id);
    const teacherId = newTeacherId || null;

    const { error } = await supabase
      .from('batches')
      .update({ teacher_id: teacherId })
      .eq('id', batch.id);

    if (error) {
      toastError(error, 'Failed to update teacher assignment.');
    } else {
      if (teacherId && batch.course_id) {
        await syncTeacherBatchAssignment(teacherId, batch.course_id);
      }
      toastSuccess('Teacher assignment updated.');
      await fetchData();
    }
    setUpdatingTeacherBatchId(null);
  };

  // Deletion handling
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    if (deleteTarget.type === 'course') {
      const { error } = await supabase.from('courses').delete().eq('id', deleteTarget.id);
      if (error) toastError(error, 'Cannot delete course with active batches or records.');
      else toastSuccess('Course deleted.');
    } else {
      const { error } = await supabase.from('batches').delete().eq('id', deleteTarget.id);
      if (error) toastError(error, 'Cannot delete batch with active students.');
      else toastSuccess('Batch deleted.');
    }
    setDeleting(false);
    setDeleteTarget(null);
    await fetchData();
  };

  // View Students inside Batch
  const viewStudents = async (batchId: string) => {
    if (viewStudentsBatchId === batchId) {
      setViewStudentsBatchId(null);
      return;
    }
    setViewStudentsBatchId(batchId);
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, application_id, profiles(full_name, email, phone)')
      .eq('batch_id', batchId);

    if (error) {
      toastError(error, 'Failed to load students for this batch.');
      setBatchStudents([]);
    } else {
      setBatchStudents(data ?? []);
    }
    setLoadingStudents(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Title & Top Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Courses & Batches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage course offerings, batch schedules, and individual batch-wise teacher assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2 shadow-sm" onClick={openCreateCourse}>
            <Plus className="h-4 w-4" /> Add Course
          </Button>
          <Button variant="outline" className="gap-2 shadow-sm" onClick={() => openCreateBatch()}>
            <Plus className="h-4 w-4" /> Add Batch
          </Button>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Courses
              </p>
              <h3 className="mt-1 text-2xl font-bold">{totalCourses}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Active Batches
              </p>
              <h3 className="mt-1 text-2xl font-bold">{totalBatches}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Students
              </p>
              <h3 className="mt-1 text-2xl font-bold">{totalEnrolledStudents}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Needs Teacher
              </p>
              <h3 className="mt-1 text-2xl font-bold">{unassignedBatchesCount}</h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <UserX className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses, batches, or teacher names..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Filter:
              </div>
              <select
                className="h-9 rounded-md border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                value={feeFilter}
                onChange={(e) => setFeeFilter(e.target.value as any)}
              >
                <option value="all">All Fees</option>
                <option value="free">Free Courses Only</option>
                <option value="paid">Paid Courses Only</option>
              </select>
              <select
                className="h-9 rounded-md border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value as any)}
              >
                <option value="all">All Assignments</option>
                <option value="assigned">Assigned Teachers</option>
                <option value="unassigned">Unassigned Batches</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Create/Edit Course */}
      {showCourseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-2 border-primary/20 shadow-2xl bg-card max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <form onSubmit={saveCourse} className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      {editingCourse ? 'Edit Course' : 'Create New Course'}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCourseForm(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Course Title</label>
                    <Input
                      placeholder="e.g. Graphic Designing & Video Editing"
                      value={courseForm.name}
                      onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <textarea
                      className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Provide a short outline of this course..."
                      value={courseForm.description}
                      onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={courseForm.is_free}
                      onChange={(e) =>
                        setCourseForm((f) => ({
                          ...f,
                          is_free: e.target.checked,
                          ...(e.target.checked ? { initial_fee: '0', monthly_fee: '0' } : {}),
                        }))
                      }
                    />
                    <div>
                      <span className="font-semibold text-foreground">Free Course</span>
                      <p className="text-xs text-muted-foreground">
                        No initial or monthly fees will be charged to students.
                      </p>
                    </div>
                  </label>

                  {!courseForm.is_free && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Initial Fee (PKR)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 2000"
                          value={courseForm.initial_fee}
                          onChange={(e) =>
                            setCourseForm((f) => ({ ...f, initial_fee: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Monthly Fee (PKR)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 1500"
                          value={courseForm.monthly_fee}
                          onChange={(e) =>
                            setCourseForm((f) => ({ ...f, monthly_fee: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCourseForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingCourse ? 'Update Course' : 'Create Course'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Create/Edit Batch */}
      {showBatchForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-xl border-2 border-blue-500/20 shadow-2xl bg-card max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <form onSubmit={saveBatch} className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">
                      {editingBatch ? 'Edit Batch Details' : 'Create New Batch'}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBatchForm(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Batch Name</label>
                    <Input
                      placeholder="e.g. CIT Morning Batch 1"
                      value={batchForm.name}
                      onChange={(e) => setBatchForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Batch Gender</label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={batchForm.gender}
                      onChange={(e) => setBatchForm((f) => ({ ...f, gender: e.target.value as any }))}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>



                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Assigned Course</label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={batchForm.course_id}
                      onChange={(e) => setBatchForm((f) => ({ ...f, course_id: e.target.value }))}
                      required
                    >
                      <option value="">Select course...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Assigned Teacher</label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={batchForm.teacher_id}
                      onChange={(e) => setBatchForm((f) => ({ ...f, teacher_id: e.target.value }))}
                    >
                      <option value="">No teacher (Unassigned)</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Styled Timing & Schedule Container */}
                  <div className="sm:col-span-2 rounded-xl border bg-gradient-to-br from-blue-50/40 via-background to-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-blue-600" /> Timing & Schedule
                      </label>
                      <span className="text-[11px] font-medium text-muted-foreground">Select or Pick Slot</span>
                    </div>

                    {/* Presets Dropdown + Time/Day Quick Pickers */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Full Presets Dropdown</label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                          value={SCHEDULE_PRESETS.includes(batchForm.timing) ? batchForm.timing : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setBatchForm((f) => ({ ...f, timing: e.target.value }));
                            }
                          }}
                        >
                          <option value="">Select from full preset list...</option>
                          {SCHEDULE_PRESETS.map((sched) => (
                            <option key={sched} value={sched}>
                              {sched}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Time Slot</label>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                            value={selectedSlot}
                            onChange={(e) => {
                              setSelectedSlot(e.target.value);
                              combineTiming(e.target.value, selectedDay);
                            }}
                          >
                            <option value="">Slot...</option>
                            {COMMON_TIME_SLOTS.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Days</label>
                          <select
                            className="h-9 w-full rounded-md border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                            value={selectedDay}
                            onChange={(e) => {
                              setSelectedDay(e.target.value);
                              combineTiming(selectedSlot, e.target.value);
                            }}
                          >
                            <option value="">Days...</option>
                            {COMMON_DAYS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Active Selected Schedule Result */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Active Schedule Text (Editable)</label>
                      <Input
                        placeholder="e.g. 09:00 AM - 11:00 AM (Thursday - Friday)"
                        value={batchForm.timing}
                        onChange={(e) => setBatchForm((f) => ({ ...f, timing: e.target.value }))}
                        className="bg-background text-xs font-semibold text-primary border-primary/30"
                      />
                    </div>
                  </div>






                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                    <Input
                      type="date"
                      value={batchForm.start_date}
                      onChange={(e) => setBatchForm((f) => ({ ...f, start_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
                    <Input
                      type="date"
                      value={batchForm.end_date}
                      onChange={(e) => setBatchForm((f) => ({ ...f, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBatchForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingBatch ? 'Update Batch' : 'Create Batch'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Confirm Deletion</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>

              <p className="mt-4 text-sm">
                Are you sure you want to delete the {deleteTarget.type}{' '}
                <span className="font-semibold text-foreground">“{deleteTarget.name}”</span>?
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Course List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No courses found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery || feeFilter !== 'all' || teacherFilter !== 'all'
                ? 'Try adjusting your search query or filters above.'
                : 'Get started by creating your first course.'}
            </p>
            <Button className="mt-4 gap-2" onClick={openCreateCourse}>
              <Plus className="h-4 w-4" /> Add Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredCourses.map((course) => {
            const courseBatches = batchesByCourse[course.id] || [];
            const courseStudentCount = courseBatches.reduce(
              (sum, b) => sum + (b.student_count || 0),
              0,
            );
            const isCollapsed = expandedCourseIds[course.id] === false;

            return (
              <Card key={course.id} className="overflow-hidden border shadow-sm transition-all hover:shadow-md">
                {/* Course Header */}
                <CardHeader className="border-b bg-muted/20 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl font-bold">{course.name}</CardTitle>
                          {course.is_free ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              Free Course
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              Initial: PKR {Number(course.initial_fee ?? 0).toLocaleString()} · Monthly: PKR {Number(course.monthly_fee ?? 0).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {course.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {course.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Layers className="h-3.5 w-3.5 text-blue-600" />
                            {courseBatches.length} batch{courseBatches.length === 1 ? '' : 'es'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Users className="h-3.5 w-3.5 text-emerald-600" />
                            {courseStudentCount} enrolled student{courseStudentCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Course Level Controls */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openCreateBatch(course.id)}
                      >
                        <Plus className="h-3.5 w-3.5 text-blue-600" /> Add Batch
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditCourse(course)}
                        title="Edit course details"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setDeleteTarget({ type: 'course', id: course.id, name: course.name })
                        }
                        title="Delete course"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleCourseExpand(course.id)}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Batches Content Table */}
                {!isCollapsed && (
                  <CardContent className="p-0">
                    {courseBatches.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        <Layers className="mx-auto h-8 w-8 text-muted-foreground/30" />
                        <p className="mt-2">No batches created for this course yet.</p>
                        <Button
                          variant="link"
                          className="mt-1 h-auto p-0 text-xs text-primary"
                          onClick={() => openCreateBatch(course.id)}
                        >
                          + Create first batch
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">SR#</th>
                              <th className="px-4 py-3">Batch Name</th>
                              <th className="px-4 py-3">Gender</th>
                              <th className="px-4 py-3">Assigned Teacher</th>
                              <th className="px-4 py-3">Students</th>
                              <th className="px-4 py-3">Timing</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {courseBatches.map((batch, index) => {
                              const gender = batchGenderLabel(batch.name);
                              const isTeacherUpdating = updatingTeacherBatchId === batch.id;

                              return (
                                <Fragment key={batch.id}>
                                  <tr className="transition-colors hover:bg-muted/10">
                                    <td className="px-4 py-3.5 font-medium text-muted-foreground">
                                      {index + 1}
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span className="font-semibold text-foreground">
                                        {cleanBatchDisplayName(batch.name)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border ${
                                          gender === 'Female'
                                            ? 'bg-pink-100 text-pink-800 border-pink-200'
                                            : gender === 'Male'
                                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                                              : 'bg-purple-100 text-purple-800 border-purple-200'
                                        }`}
                                      >
                                        {gender}

                                      </span>
                                    </td>

                                    {/* Inline Teacher Selection */}
                                    <td className="px-4 py-3.5">
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          disabled={isTeacherUpdating}
                                          className={`h-8 w-full max-w-[180px] rounded-md border text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                                            batch.teacher_id
                                              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 font-semibold'
                                              : 'border-amber-200 bg-amber-50/50 text-amber-900 italic'
                                          }`}
                                          value={batch.teacher_id || ''}
                                          onChange={(e) =>
                                            handleInlineTeacherChange(batch, e.target.value)
                                          }
                                        >
                                          <option value="" className="text-muted-foreground not-italic">
                                            ⚠️ Unassigned
                                          </option>
                                          {teachers.map((t) => (
                                            <option key={t.id} value={t.id} className="not-italic">
                                              {t.name}
                                            </option>
                                          ))}
                                        </select>
                                        {isTeacherUpdating && (
                                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <button
                                        type="button"
                                        onClick={() => viewStudents(batch.id)}
                                        className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                                      >
                                        <Users className="h-3 w-3 text-muted-foreground" />
                                        {batch.student_count ?? 0}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                                      {batch.timing ? (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                          {batch.timing}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs"
                                          onClick={() => openEditBatch(batch)}
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: 'batch',
                                              id: batch.id,
                                              name: cleanBatchDisplayName(batch.name),
                                            })
                                          }
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* View Enrolled Students Accordion */}
                                  {viewStudentsBatchId === batch.id && (
                                    <tr className="bg-muted/20">
                                      <td colSpan={7} className="px-6 py-4">
                                        <div className="rounded-lg border bg-background p-4 shadow-inner">
                                          <div className="flex items-center justify-between border-b pb-2">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                              Enrolled Students for {cleanBatchDisplayName(batch.name)}
                                            </h4>
                                            <span className="text-xs font-medium text-muted-foreground">
                                              Total: {batchStudents.length}
                                            </span>
                                          </div>
                                          {loadingStudents ? (
                                            <div className="py-4 text-center text-xs text-muted-foreground">
                                              Loading students...
                                            </div>
                                          ) : batchStudents.length === 0 ? (
                                            <p className="py-4 text-center text-xs text-muted-foreground">
                                              No students enrolled in this batch yet.
                                            </p>
                                          ) : (
                                            <div className="mt-2 max-h-48 overflow-y-auto divide-y text-xs">
                                              {batchStudents.map((s) => {
                                                const profile = relationOne(s.profiles);
                                                return (
                                                  <div
                                                    key={s.id}
                                                    className="flex items-center justify-between py-2"
                                                  >
                                                    <span className="font-medium">
                                                      {profile?.full_name || 'Student'}
                                                    </span>
                                                    <div className="flex items-center gap-3 font-mono text-muted-foreground">
                                                      {s.application_id && (
                                                        <span className="rounded bg-muted px-1.5 py-0.5">
                                                          ID: {s.application_id}
                                                        </span>
                                                      )}
                                                      <span>{profile?.email}</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

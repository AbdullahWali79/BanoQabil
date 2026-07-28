import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BookOpen, Plus, X } from 'lucide-react';
import { cleanBatchDisplayName, relationOne } from '@/features/teacher/utils/teacherData';

type Course = { id: string; name: string; description: string | null };
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

function batchGenderLabel(name: string): string {
  const n = cleanBatchDisplayName(name).toLowerCase();
  if (/\bfemale\b/.test(n)) return 'Female';
  if (/\bmale\b/.test(n)) return 'Male';
  return '—';
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: '', description: '' });
  const [batchForm, setBatchForm] = useState({
    name: '',
    course_id: '',
    teacher_id: '',
    timing: '',
    start_date: '',
    end_date: '',
  });
  const [viewStudentsBatchId, setViewStudentsBatchId] = useState<string | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage('');

    const [coursesRes, batchesRes, teachersRes] = await Promise.all([
      supabase.from('courses').select('*').order('name'),
      supabase.from('batches').select('*').order('name'),
      supabase.from('teachers').select('id, profiles(full_name, status)'),
    ]);

    if (coursesRes.error) setErrorMessage(coursesRes.error.message);
    if (batchesRes.error) setErrorMessage(batchesRes.error.message);

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

  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm({ name: '', description: '' });
    setShowCourseForm(true);
    setShowBatchForm(false);
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({ name: course.name, description: course.description || '' });
    setShowCourseForm(true);
    setShowBatchForm(false);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name.trim()) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (editingCourse) {
      const { error } = await supabase
        .from('courses')
        .update({
          name: courseForm.name.trim(),
          description: courseForm.description.trim() || null,
        })
        .eq('id', editingCourse.id);
      if (error) setErrorMessage(error.message);
      else setSuccessMessage('Course updated.');
    } else {
      const { error } = await supabase.from('courses').insert({
        name: courseForm.name.trim(),
        description: courseForm.description.trim() || null,
      });
      if (error) setErrorMessage(error.message);
      else setSuccessMessage('Course created.');
    }

    setSaving(false);
    setShowCourseForm(false);
    await fetchData();
  };

  const openCreateBatch = (courseId?: string) => {
    setEditingBatch(null);
    setBatchForm({
      name: '',
      course_id: courseId || courses[0]?.id || '',
      teacher_id: '',
      timing: '',
      start_date: '',
      end_date: '',
    });
    setShowBatchForm(true);
    setShowCourseForm(false);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setBatchForm({
      name: cleanBatchDisplayName(batch.name),
      course_id: batch.course_id || '',
      teacher_id: batch.teacher_id || '',
      timing: batch.timing || '',
      start_date: batch.start_date || '',
      end_date: batch.end_date || '',
    });
    setShowBatchForm(true);
    setShowCourseForm(false);
  };

  const saveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.name.trim() || !batchForm.course_id) {
      setErrorMessage('Batch name and course are required.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const cleanName = cleanBatchDisplayName(batchForm.name.trim());

    const payload = {
      name: cleanName,
      course_id: batchForm.course_id,
      teacher_id: batchForm.teacher_id || null,
      timing: batchForm.timing.trim() || null,
      start_date: batchForm.start_date || null,
      end_date: batchForm.end_date || null,
    };

    if (editingBatch) {
      const { error } = await supabase.from('batches').update(payload).eq('id', editingBatch.id);
      if (error) setErrorMessage(error.message);
      else setSuccessMessage('Batch updated.');
    } else {
      const { error } = await supabase.from('batches').insert(payload);
      if (error) setErrorMessage(error.message);
      else setSuccessMessage('Batch created.');
    }

    setSaving(false);
    setShowBatchForm(false);
    await fetchData();
  };

  const viewStudents = async (batchId: string) => {
    setViewStudentsBatchId((prev) => (prev === batchId ? null : batchId));
    if (viewStudentsBatchId === batchId) return;
    const { data, error } = await supabase
      .from('students')
      .select('id, application_id, profiles(full_name, email)')
      .eq('batch_id', batchId);
    if (error) {
      setErrorMessage(error.message);
      setBatchStudents([]);
    } else {
      setBatchStudents(data ?? []);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Batches</h1>
          <p className="mt-1 text-muted-foreground">
            Manage courses, batches, and teacher assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={openCreateCourse}>
            <Plus className="h-4 w-4" /> Add Course
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => openCreateBatch()}>
            <Plus className="h-4 w-4" /> Add Batch
          </Button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            successMessage
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {errorMessage || successMessage}
        </div>
      )}

      {showCourseForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={saveCourse} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {editingCourse ? 'Edit Course' : 'New Course'}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCourseForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Course name"
                value={courseForm.name}
                onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Description"
                value={courseForm.description}
                onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Course'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showBatchForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={saveBatch} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {editingBatch ? 'Edit Batch' : 'New Batch'}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBatchForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use names like “Graphic Designing Female”. Do not add tid: prefixes.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Batch name"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={batchForm.course_id}
                  onChange={(e) => setBatchForm((f) => ({ ...f, course_id: e.target.value }))}
                  required
                >
                  <option value="">Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={batchForm.teacher_id}
                  onChange={(e) => setBatchForm((f) => ({ ...f, teacher_id: e.target.value }))}
                >
                  <option value="">No teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Timing (e.g. Thu-Fri 9AM)"
                  value={batchForm.timing}
                  onChange={(e) => setBatchForm((f) => ({ ...f, timing: e.target.value }))}
                />
                <Input
                  type="date"
                  value={batchForm.start_date}
                  onChange={(e) => setBatchForm((f) => ({ ...f, start_date: e.target.value }))}
                />
                <Input
                  type="date"
                  value={batchForm.end_date}
                  onChange={(e) => setBatchForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Batch'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No courses yet. Click “Add Course” to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => {
            const courseBatches = batchesByCourse[course.id] || [];
            const totalStudents = courseBatches.reduce(
              (sum, b) => sum + (b.student_count || 0),
              0,
            );

            return (
              <Card key={course.id}>
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{course.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {course.description || 'No description'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {courseBatches.length} batch{courseBatches.length === 1 ? '' : 'es'} ·{' '}
                          {totalStudents} student{totalStudents === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCreateBatch(course.id)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Batch
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditCourse(course)}>
                        Edit Course
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {courseBatches.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">
                      No batches for this course yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-3">SR#</th>
                            <th className="px-4 py-3">Batch Name</th>
                            <th className="px-4 py-3">Gender</th>
                            <th className="px-4 py-3">Teacher</th>
                            <th className="px-4 py-3">Students</th>
                            <th className="px-4 py-3">Timing</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseBatches.map((batch, index) => (
                            <Fragment key={batch.id}>
                              <tr className="border-b">
                                <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                                <td className="px-4 py-3 font-medium">
                                  {cleanBatchDisplayName(batch.name)}
                                </td>
                                <td className="px-4 py-3">{batchGenderLabel(batch.name)}</td>
                                <td className="px-4 py-3">{batch.teacher_name}</td>
                                <td className="px-4 py-3">{batch.student_count ?? 0}</td>
                                <td className="px-4 py-3">{batch.timing || '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditBatch(batch)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => viewStudents(batch.id)}
                                    >
                                      Students
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {viewStudentsBatchId === batch.id && (
                                <tr className="border-b bg-muted/20">
                                  <td colSpan={7} className="px-4 py-3">
                                    <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                                      {batchStudents.length === 0 ? (
                                        <p className="text-muted-foreground">
                                          No students in this batch.
                                        </p>
                                      ) : (
                                        batchStudents.map((s) => {
                                          const profile = relationOne(s.profiles);
                                          return (
                                            <div
                                              key={s.id}
                                              className="flex justify-between gap-2"
                                            >
                                              <span>{profile?.full_name || 'Student'}</span>
                                              <span className="font-mono text-muted-foreground">
                                                {s.application_id || profile?.email}
                                              </span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

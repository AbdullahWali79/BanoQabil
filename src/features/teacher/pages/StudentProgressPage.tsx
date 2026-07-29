import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Search,
  X,
} from 'lucide-react';
import {
  cleanBatchDisplayName,
  getTeacherAssignedCourse,
  getTeacherBatches,
  getTeacherStudents,
  relationOne,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

const PAGE_SIZE = 50;

type StudentRow = {
  id: string;
  batch_id: string | null;
  course_id?: string | null;
  application_id: string | null;
  gender?: string | null;
  profiles?:
    | { full_name?: string | null; email?: string | null; phone?: string | null }
    | { full_name?: string | null; email?: string | null; phone?: string | null }[]
    | null;
  courses?:
    | { id?: string; name?: string | null }
    | { id?: string; name?: string | null }[]
    | null;
  batches?:
    | { id?: string; name?: string | null }
    | { id?: string; name?: string | null }[]
    | null;
};

type AssignmentRow = {
  id: string;
  batch_id: string;
  title: string;
  due_date: string | null;
  status: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  marks: number | null;
  remarks: string | null;
  status: string | null;
  submitted_at: string | null;
  youtube_url: string | null;
  drive_url: string | null;
};

type AttendanceRow = {
  student_id: string;
  attendance_date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused' | string;
};

type AssignmentDetail = {
  assignment_id: string;
  title: string;
  due_date: string | null;
  assignment_status: string | null;
  submission_status: string | null;
  submitted_at: string | null;
  marks: number | null;
  remarks: string | null;
  youtube_url: string | null;
  drive_url: string | null;
};

type ProgressRow = {
  student_id: string;
  student_name: string;
  email: string;
  phone: string;
  application_id: string;
  batch: string;
  course: string;
  assigned: number;
  submitted: number;
  graded: number;
  avg_marks: number | null;
  attendance_pct: number | null;
  present_days: number;
  absent_days: number;
  late_days: number;
  excused_days: number;
  total_attendance_days: number;
  assignments: AssignmentDetail[];
  attendance: AttendanceRow[];
};

function marksClass(marks: number | null) {
  if (marks == null) return 'text-muted-foreground';
  if (marks >= 80) return 'text-emerald-700 font-semibold';
  if (marks >= 50) return 'text-amber-700 font-semibold';
  return 'text-red-700 font-semibold';
}

function statusBadge(status: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'graded') return 'bg-emerald-100 text-emerald-800';
  if (s === 'submitted') return 'bg-blue-100 text-blue-800';
  if (s === 'absent') return 'bg-red-100 text-red-800';
  if (s === 'present') return 'bg-emerald-100 text-emerald-800';
  if (s === 'late') return 'bg-amber-100 text-amber-800';
  if (s === 'excused') return 'bg-sky-100 text-sky-800';
  return 'bg-muted text-muted-foreground';
}

export default function StudentProgressPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(
    () => searchParams.get('q') || searchParams.get('student') || '',
  );
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [genderScope, setGenderScope] = useState<GenderScope | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('student');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    async function loadProgress() {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage('');

      try {
        const assigned = await getTeacherAssignedCourse(user.id);
        setCourseName(assigned?.name ?? null);
        setGenderScope(assigned?.genderScope ?? null);

      const teacherBatches = await getTeacherBatches(user.id);
      const batchIds = teacherBatches.map((b) => b.id);
        const batchNameMap = teacherBatches.reduce(
          (acc: Record<string, string>, b) => {
            acc[b.id] = b.display_name || cleanBatchDisplayName(b.name) || 'Batch';
        return acc;
          },
          {},
        );

        let students: StudentRow[] = [];
        try {
          students = await getTeacherStudents<StudentRow>(
            user.id,
            `id, batch_id, course_id, application_id, gender,
             profiles(full_name, email, phone),
             courses(id, name),
             batches(id, name)`,
          );
        } catch {
          students = await getTeacherStudents<StudentRow>(
            user.id,
            'id, batch_id, course_id, application_id, profiles(full_name, email), courses(id, name), batches(id, name)',
          );
        }

        if (students.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

        const studentIds = students.map((s) => s.id);

        const assignmentQuery =
          batchIds.length > 0
            ? supabase
                .from('assignments')
                .select('id, batch_id, title, due_date, status')
                .in('batch_id', batchIds)
                .order('due_date', { ascending: true })
            : Promise.resolve({ data: [] as AssignmentRow[], error: null });

        const [{ data: assignmentsData }, { data: attendanceData }] = await Promise.all([
          assignmentQuery,
        supabase
            .from('attendance')
            .select('student_id, attendance_date, status')
            .in('student_id', studentIds)
            .order('attendance_date', { ascending: false }),
        ]);

      const assignments = (assignmentsData ?? []) as AssignmentRow[];
      const assignmentIds = assignments.map((a) => a.id);
        const assignmentsByBatch = assignments.reduce(
          (acc: Record<string, AssignmentRow[]>, a) => {
            if (!acc[a.batch_id]) acc[a.batch_id] = [];
            acc[a.batch_id].push(a);
            return acc;
          },
          {},
        );

      let submissions: SubmissionRow[] = [];
      if (assignmentIds.length > 0) {
        const { data: submissionsData } = await supabase
          .from('submissions')
            .select(
              'id, assignment_id, student_id, marks, remarks, status, submitted_at, youtube_url, drive_url',
            )
          .in('assignment_id', assignmentIds);
        submissions = (submissionsData ?? []) as SubmissionRow[];
      }

        const submissionsByStudent = submissions.reduce(
          (acc: Record<string, SubmissionRow[]>, s) => {
        if (!acc[s.student_id]) acc[s.student_id] = [];
        acc[s.student_id].push(s);
        return acc;
          },
          {},
        );

        const attendanceByStudent = ((attendanceData ?? []) as AttendanceRow[]).reduce(
          (acc: Record<string, AttendanceRow[]>, row) => {
            if (!acc[row.student_id]) acc[row.student_id] = [];
            acc[row.student_id].push(row);
            return acc;
          },
          {},
        );

      const progressRows: ProgressRow[] = students.map((student) => {
          const profile = relationOne(student.profiles);
          const course = relationOne(student.courses);
          const batch = relationOne(student.batches);
          const batchAssignments = student.batch_id
            ? assignmentsByBatch[student.batch_id] ?? []
            : [];
          const studentSubs = submissionsByStudent[student.id] ?? [];
          const subByAssignment = Object.fromEntries(
            studentSubs.map((s) => [s.assignment_id, s]),
          );

          const assignmentDetails: AssignmentDetail[] = batchAssignments.map((a) => {
            const sub = subByAssignment[a.id];
            return {
              assignment_id: a.id,
              title: a.title,
              due_date: a.due_date,
              assignment_status: a.status,
              submission_status: sub?.status ?? null,
              submitted_at: sub?.submitted_at ?? null,
              marks: sub?.marks ?? null,
              remarks: sub?.remarks ?? null,
              youtube_url: sub?.youtube_url ?? null,
              drive_url: sub?.drive_url ?? null,
            };
          });

          const graded = assignmentDetails.filter((a) => a.marks != null);
        const avgMarks = graded.length
            ? Math.round(
                graded.reduce((sum, a) => sum + (a.marks ?? 0), 0) / graded.length,
              )
          : null;

          const att = attendanceByStudent[student.id] ?? [];
          let present = 0;
          let absent = 0;
          let late = 0;
          let excused = 0;
          for (const row of att) {
            if (row.status === 'Present') present += 1;
            else if (row.status === 'Absent') absent += 1;
            else if (row.status === 'Late') late += 1;
            else if (row.status === 'Excused') excused += 1;
          }
          const total = att.length;
          const attendancePct =
            total > 0 ? Math.round(((present + late) / total) * 100) : null;

        return {
          student_id: student.id,
            student_name: profile?.full_name || 'Unknown Student',
            email: profile?.email || '—',
            phone: profile?.phone || '—',
            application_id: student.application_id || '',
            batch: student.batch_id
              ? batchNameMap[student.batch_id] ||
                cleanBatchDisplayName(batch?.name) ||
                '—'
              : cleanBatchDisplayName(batch?.name),
            course: course?.name || courseName || '—',
            assigned: batchAssignments.length,
          submitted: studentSubs.length,
          graded: graded.length,
          avg_marks: avgMarks,
            attendance_pct: attendancePct,
            present_days: present,
            absent_days: absent,
            late_days: late,
            excused_days: excused,
            total_attendance_days: total,
            assignments: assignmentDetails,
            attendance: att,
        };
      });

      setRows(progressRows);

        // Auto-open detail if URL search matches one student
        const q = (searchParams.get('q') || searchParams.get('student') || '').toLowerCase();
        if (q) {
          const hit = progressRows.find(
            (r) =>
              r.application_id.toLowerCase() === q ||
              r.application_id.toLowerCase().includes(q) ||
              r.student_name.toLowerCase().includes(q),
          );
          if (hit) setSelectedId(hit.student_id);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load progress');
        setRows([]);
      } finally {
      setLoading(false);
      }
    }

    void loadProgress();
  }, [user?.id, searchParams]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.student_name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.application_id.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q),
    );
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const selected = rows.find((r) => r.student_id === selectedId) || null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [selectedId]);

  const absentDays = useMemo(
    () =>
      selected
        ? selected.attendance
            .filter((a) => a.status === 'Absent')
            .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
        : [],
    [selected],
  );

  const lateDays = useMemo(
    () =>
      selected
        ? selected.attendance
            .filter((a) => a.status === 'Late')
            .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
        : [],
    [selected],
  );

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope} loading={loading}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Progress</h1>
            <p className="mt-1 text-muted-foreground">
              Every student in your class — assignment marks, attendance %, and absent days.
              Click <span className="font-medium text-foreground">View</span> for full detail.
            </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, App ID..."
            className="pl-9"
          />
        </div>
      </div>

        {errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Class avg marks</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const vals = rows
                    .map((r) => r.avg_marks)
                    .filter((v): v is number => v != null);
                  if (!vals.length) return '—';
                  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                })()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Class avg attendance</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const vals = rows
                    .map((r) => r.attendance_pct)
                    .filter((v): v is number => v != null);
                  if (!vals.length) return '—';
                  return `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%`;
                })()}
              </p>
            </CardContent>
          </Card>
        </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                      <th className="px-3 py-3 font-semibold">SR#</th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-3 py-3 font-semibold">App ID</th>
                      <th className="px-3 py-3 font-semibold">Assigned</th>
                      <th className="px-3 py-3 font-semibold">Submitted</th>
                      <th className="px-3 py-3 font-semibold">Graded</th>
                      <th className="px-3 py-3 font-semibold">Avg Marks</th>
                      <th className="px-3 py-3 font-semibold">Attendance</th>
                      <th className="px-3 py-3 font-semibold">Absent</th>
                      <th className="px-3 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                        <td colSpan={10} className="px-6 py-10 text-center text-muted-foreground">
                      Loading progress...
                    </td>
                  </tr>
                    ) : pageRows.length === 0 ? (
                  <tr>
                        <td colSpan={10} className="px-6 py-10 text-center text-muted-foreground">
                      <BarChart3 className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No students/progress found.
                    </td>
                  </tr>
                ) : (
                      pageRows.map((row, index) => {
                        const sr = (currentPage - 1) * PAGE_SIZE + index + 1;
                        return (
                          <tr
                            key={row.student_id}
                            className={`border-b transition-colors ${
                              selectedId === row.student_id
                                ? 'bg-primary/10'
                                : 'hover:bg-muted/40'
                            }`}
                          >
                            <td className="px-3 py-3 text-muted-foreground">{sr}</td>
                            <td className="px-4 py-3">
                        <div className="font-medium">{row.student_name}</div>
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      </td>
                            <td className="px-3 py-3 font-mono text-xs">
                              {row.application_id || '—'}
                            </td>
                            <td className="px-3 py-3">{row.assigned}</td>
                            <td className="px-3 py-3">{row.submitted}</td>
                            <td className="px-3 py-3">{row.graded}</td>
                            <td className={`px-3 py-3 ${marksClass(row.avg_marks)}`}>
                              {row.avg_marks != null ? `${row.avg_marks}/100` : '—'}
                            </td>
                            <td className="px-3 py-3 font-semibold">
                              {row.attendance_pct == null ? '—' : `${row.attendance_pct}%`}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={
                                  row.absent_days > 0
                                    ? 'font-semibold text-red-700'
                                    : 'text-muted-foreground'
                                }
                              >
                                {row.absent_days}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedId(row.student_id)}
                              >
                                <Eye size={14} />
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > PAGE_SIZE ? (
                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {(currentPage - 1) * PAGE_SIZE + 1}—
                    {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of{' '}
                    {filteredRows.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </Button>
                    <span className="min-w-[4.5rem] text-center text-sm font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

        {selected && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-progress-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                  aria-label="Close popup"
                  onClick={() => setSelectedId(null)}
                />
                <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
                  <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <h2
                        id="student-progress-title"
                        className="truncate text-xl font-bold tracking-tight"
                      >
                        {selected.student_name}
                      </h2>
                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        App ID: {selected.application_id || '—'} · {selected.email}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {selected.course} · {selected.batch}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => setSelectedId(null)}
                      aria-label="Close"
                    >
                      <X size={18} />
                    </Button>
                  </div>

                  <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Avg marks</p>
                        <p className={`mt-1 text-xl font-bold ${marksClass(selected.avg_marks)}`}>
                          {selected.avg_marks != null ? `${selected.avg_marks}/100` : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Attendance</p>
                        <p className="mt-1 text-xl font-bold">
                          {selected.attendance_pct == null
                            ? '—'
                            : `${selected.attendance_pct}%`}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Present</p>
                        <p className="mt-1 text-xl font-bold text-emerald-700">
                          {selected.present_days}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Absent</p>
                        <p className="mt-1 text-xl font-bold text-red-700">
                          {selected.absent_days}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <ClipboardList size={16} className="text-primary" />
                        Assignment marks
                      </h3>
                      {selected.assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No assignments created for this student&apos;s batch yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selected.assignments.map((a, i) => (
                            <div
                              key={a.assignment_id}
                              className="rounded-xl border px-4 py-3 text-sm"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {i + 1}. {a.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Due{' '}
                                    {a.due_date
                                      ? new Date(a.due_date).toLocaleDateString()
                                      : '—'}
                                  </p>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                  <p className={`text-base ${marksClass(a.marks)}`}>
                                    {a.marks != null ? `${a.marks} / 100` : 'No marks'}
                                  </p>
                                  <span
                                    className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadge(
                                      a.marks != null
                                        ? 'Graded'
                                        : a.submission_status || 'Pending',
                                    )}`}
                                  >
                                    {a.marks != null
                                      ? 'Graded'
                                      : a.submission_status || 'Not submitted'}
                                  </span>
                                </div>
                              </div>
                              {a.remarks ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Remark: {a.remarks}
                                </p>
                              ) : null}
                              {(a.youtube_url || a.drive_url) && (
                                <div className="mt-2 flex gap-3 text-xs">
                                  {a.youtube_url ? (
                                    <a
                                      href={a.youtube_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      YouTube
                                    </a>
                                  ) : null}
                                  {a.drive_url ? (
                                    <a
                                      href={a.drive_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Drive
                                    </a>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays size={16} className="text-primary" />
                        Attendance detail
                      </h3>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Total days recorded: {selected.total_attendance_days} · Late:{' '}
                        {selected.late_days} · Excused: {selected.excused_days}
                      </p>

                      <div className="mb-3">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
                          Absent days ({absentDays.length})
                        </p>
                        {absentDays.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No absent days.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {absentDays.map((d) => (
                              <span
                                key={`${d.attendance_date}-absent`}
                                className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
                              >
                                {new Date(d.attendance_date).toLocaleDateString()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {lateDays.length > 0 ? (
                        <div className="mb-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                            Late days ({lateDays.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {lateDays.map((d) => (
                              <span
                                key={`${d.attendance_date}-late`}
                                className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900"
                              >
                                {new Date(d.attendance_date).toLocaleDateString()}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="max-h-52 overflow-y-auto rounded-xl border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/90">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold">
                                Date
                              </th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.attendance.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="px-3 py-4 text-center text-muted-foreground"
                                >
                                  No attendance records yet.
                                </td>
                              </tr>
                            ) : (
                              selected.attendance.map((d) => (
                                <tr
                                  key={`${d.attendance_date}-${d.status}`}
                                  className="border-t"
                                >
                                  <td className="px-3 py-2.5">
                                    {new Date(d.attendance_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span
                                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge(
                                        d.status,
                                      )}`}
                                    >
                                      {d.status}
                                    </span>
                                  </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-t px-5 py-3 sm:px-6">
                    <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
    </div>
    </TeacherAssignmentGate>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  Layers,
  RefreshCw,
  Users,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { relationOne } from '@/features/teacher/utils/teacherData';

type TeacherReport = {
  teacherId: string;
  teacherName: string;
  email: string;
  course: string;
  genderScope: string;
  students: number;
  assignments: number;
  submissions: number;
  pending: number;
  graded: number;
  avgMarks: number | null;
};

type CourseReport = {
  courseId: string;
  courseName: string;
  batches: number;
  students: number;
  male: number;
  female: number;
};

type Overview = {
  teachers: number;
  students: number;
  courses: number;
  batches: number;
  assignments: number;
  submissions: number;
  pendingGrades: number;
  pendingApprovals: number;
  attendanceRecords: number;
};

const emptyOverview: Overview = {
  teachers: 0,
  students: 0,
  courses: 0,
  batches: 0,
  assignments: 0,
  submissions: 0,
  pendingGrades: 0,
  pendingApprovals: 0,
  attendanceRecords: 0,
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [teacherRows, setTeacherRows] = useState<TeacherReport[]>([]);
  const [courseRows, setCourseRows] = useState<CourseReport[]>([]);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [
        { data: teacherData, error: teacherError },
        { data: studentData, error: studentError },
        { data: courseData },
        { data: batchData },
        { count: pendingApprovals },
        { count: attendanceCount },
      ] = await Promise.all([
        supabase
          .from('teachers')
          .select(
            'id, profile_id, profiles(full_name, email, status), teacher_courses(gender_scope, courses(name))',
          ),
        supabase.from('students').select('id, gender, course_id, batch_id'),
        supabase.from('courses').select('id, name'),
        supabase.from('batches').select('id, name, course_id'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Pending'),
        supabase.from('attendance').select('id', { count: 'exact', head: true }),
      ]);

      if (teacherError) throw teacherError;
      if (studentError) throw studentError;

      const teacherList = (teacherData ?? [])
        .map((t: Record<string, unknown>) => {
          const profile = relationOne(t.profiles as never) as {
            full_name?: string;
            email?: string;
            status?: string;
          } | null;
          const tc = relationOne(t.teacher_courses as never) as {
            gender_scope?: string | null;
            courses?: { name?: string } | { name?: string }[] | null;
          } | null;
          const course = relationOne(tc?.courses as never) as { name?: string } | null;
          return {
            id: String(t.id),
            profileId: String(t.profile_id),
            name: profile?.full_name || 'Teacher',
            email: profile?.email || '—',
            status: profile?.status,
            course: course?.name || '—',
            genderScope: tc?.gender_scope || 'Not set',
          };
        })
        .filter((t) => !t.status || t.status === 'Approved');

      setTeachers(teacherList.map((t) => ({ id: t.id, name: t.name })));

      let assignmentsQuery = supabase
        .from('assignments')
        .select('id, teacher_id, batch_id, created_at');

      if (fromDate) {
        assignmentsQuery = assignmentsQuery.gte('created_at', new Date(fromDate).toISOString());
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        assignmentsQuery = assignmentsQuery.lte('created_at', end.toISOString());
      }

      const { data: assignments, error: assignmentError } = await assignmentsQuery;
      if (assignmentError) throw assignmentError;

      const teacherKeys = new Set(teacherList.flatMap((t) => [t.id, t.profileId]));
      const assignmentRows = (assignments ?? []).filter((a) =>
        a.teacher_id ? teacherKeys.has(a.teacher_id) : true,
      );

      const assignmentIds = assignmentRows.map((a) => a.id);
      let submissions: { assignment_id: string; marks: number | null }[] = [];
      if (assignmentIds.length > 0) {
        const { data: submissionRows, error: submissionError } = await supabase
          .from('submissions')
          .select('assignment_id, marks')
          .in('assignment_id', assignmentIds);
        if (submissionError) throw submissionError;
        submissions = submissionRows ?? [];
      }

      const students = studentData ?? [];
      const batches = batchData ?? [];
      const courses = courseData ?? [];

      // Students per teacher via batch.teacher_id OR course teacher_courses
      const studentsByTeacher: Record<string, number> = {};
      for (const t of teacherList) studentsByTeacher[t.id] = 0;

      for (const b of batches) {
        const batchTeacherId = (b as { teacher_id?: string | null }).teacher_id;
        if (!batchTeacherId) continue;
        const match = teacherList.find(
          (t) => t.id === batchTeacherId || t.profileId === batchTeacherId,
        );
        if (!match) continue;
        const count = students.filter((s) => s.batch_id === b.id).length;
        studentsByTeacher[match.id] = (studentsByTeacher[match.id] || 0) + count;
      }

      const report: TeacherReport[] = teacherList.map((teacher) => {
        const teacherAssignments = assignmentRows.filter(
          (a) => a.teacher_id === teacher.id || a.teacher_id === teacher.profileId,
        );
        const ids = new Set(teacherAssignments.map((a) => a.id));
        const teacherSubs = submissions.filter((s) => ids.has(s.assignment_id));
        const graded = teacherSubs.filter((s) => s.marks != null);
        const avgMarks = graded.length
          ? Math.round(
              graded.reduce((sum, s) => sum + (s.marks ?? 0), 0) / graded.length,
            )
          : null;

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          email: teacher.email,
          course: teacher.course,
          genderScope: teacher.genderScope,
          students: studentsByTeacher[teacher.id] || 0,
          assignments: teacherAssignments.length,
          submissions: teacherSubs.length,
          pending: teacherSubs.filter((s) => s.marks == null).length,
          graded: graded.length,
          avgMarks,
        };
      });

      const courseReport: CourseReport[] = courses.map((c) => {
        const courseBatches = batches.filter((b) => b.course_id === c.id);
        const courseStudents = students.filter((s) => s.course_id === c.id);
        const male = courseStudents.filter((s) => {
          const g = String(s.gender || '').toLowerCase();
          return g === 'male';
        }).length;
        const female = courseStudents.filter((s) => {
          const g = String(s.gender || '').toLowerCase();
          return g === 'female';
        }).length;
        return {
          courseId: c.id,
          courseName: c.name,
          batches: courseBatches.length,
          students: courseStudents.length,
          male,
          female,
        };
      });

      setTeacherRows(report);
      setCourseRows(courseReport);
      setOverview({
        teachers: teacherList.length,
        students: students.length,
        courses: courses.length,
        batches: batches.length,
        assignments: assignmentRows.length,
        submissions: submissions.length,
        pendingGrades: submissions.filter((s) => s.marks == null).length,
        pendingApprovals: pendingApprovals ?? 0,
        attendanceRecords: attendanceCount ?? 0,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load report');
      setTeacherRows([]);
      setCourseRows([]);
      setOverview(emptyOverview);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const filteredTeachers = useMemo(() => {
    if (selectedTeacher === 'all') return teacherRows;
    return teacherRows.filter((r) => r.teacherId === selectedTeacher);
  }, [teacherRows, selectedTeacher]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('BanoQabil Educational Institute', 14, 22);
      doc.setFontSize(12);
      doc.text('LMS Admin Report', 14, 30);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);
      if (fromDate || toDate) {
        doc.text(`Range: ${fromDate || '…'} → ${toDate || '…'}`, 14, 42);
      }

      autoTable(doc, {
        startY: fromDate || toDate ? 48 : 42,
        head: [['Metric', 'Value']],
        body: [
          ['Teachers', String(overview.teachers)],
          ['Students', String(overview.students)],
          ['Courses', String(overview.courses)],
          ['Batches', String(overview.batches)],
          ['Assignments', String(overview.assignments)],
          ['Submissions', String(overview.submissions)],
          ['Pending grades', String(overview.pendingGrades)],
          ['Pending approvals', String(overview.pendingApprovals)],
          ['Attendance records', String(overview.attendanceRecords)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });

      autoTable(doc, {
        startY: 90,
        head: [
          [
            'Teacher',
            'Course',
            'Students',
            'Assignments',
            'Submissions',
            'Pending',
            'Avg Marks',
          ],
        ],
        body: filteredTeachers.map((r) => [
          r.teacherName,
          r.course,
          String(r.students),
          String(r.assignments),
          String(r.submissions),
          String(r.pending),
          r.avgMarks == null ? '—' : String(r.avgMarks),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
      });

      doc.addPage();
      doc.setFontSize(12);
      doc.text('Course Summary', 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [['Course', 'Batches', 'Students', 'Male', 'Female']],
        body: courseRows.map((c) => [
          c.courseName,
          String(c.batches),
          String(c.students),
          String(c.male),
          String(c.female),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.save(`banoqabil-admin-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error(error);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    { label: 'Teachers', value: overview.teachers, icon: Users, tone: 'bg-sky-500/10 text-sky-700' },
    { label: 'Students', value: overview.students, icon: GraduationCap, tone: 'bg-emerald-500/10 text-emerald-700' },
    { label: 'Courses', value: overview.courses, icon: BookOpen, tone: 'bg-indigo-500/10 text-indigo-700' },
    { label: 'Batches', value: overview.batches, icon: Layers, tone: 'bg-teal-500/10 text-teal-700' },
    { label: 'Assignments', value: overview.assignments, icon: ClipboardCheck, tone: 'bg-blue-500/10 text-blue-700' },
    { label: 'Submissions', value: overview.submissions, icon: FileDown, tone: 'bg-slate-500/10 text-slate-700' },
    { label: 'Pending grades', value: overview.pendingGrades, icon: ClipboardCheck, tone: 'bg-amber-500/10 text-amber-700' },
    { label: 'Pending approvals', value: overview.pendingApprovals, icon: UserCheck, tone: 'bg-rose-500/10 text-rose-700' },
  ];

  const scopeBadge = (scope: string) => {
    const s = scope.toLowerCase();
    if (s === 'male') return 'bg-sky-100 text-sky-800';
    if (s === 'female') return 'bg-pink-100 text-pink-800';
    if (s === 'both') return 'bg-violet-100 text-violet-800';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="reports-page min-h-full space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Admin · Read only
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Reports & Analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Institute overview of teachers, courses, and class activity. Grading stays with teachers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => void handleExport()}
            disabled={exporting || loading}
            className="gap-2 rounded-xl shadow-sm"
          >
            {exporting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
                  {loading ? '…' : s.value}
                </p>
              </div>
              <div className={`rounded-xl p-2.5 ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm xl:sticky xl:top-20">
          <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Narrow the teacher performance table.
          </p>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                className="rounded-xl"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                className="rounded-xl"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Teacher
              </label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
              >
                <option value="all">All Teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={() => void loadReport()}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Apply / Generate'}
            </Button>
            <div className="rounded-xl border border-dashed bg-muted/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Date filter uses assignment creation date. Admin monitors only — teachers create
              assignments and give marks.
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b bg-muted/30 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Teacher performance</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredTeachers.length} teacher
                  {filteredTeachers.length === 1 ? '' : 's'} shown
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">SR#</th>
                    <th className="px-4 py-3 font-semibold">Teacher</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Scope</th>
                    <th className="px-4 py-3 font-semibold text-right">Students</th>
                    <th className="px-4 py-3 font-semibold text-right">Assignments</th>
                    <th className="px-4 py-3 font-semibold text-right">Submissions</th>
                    <th className="px-4 py-3 font-semibold text-right">Pending</th>
                    <th className="px-4 py-3 font-semibold text-right">Avg marks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                        Loading report...
                      </td>
                    </tr>
                  ) : filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                        No teacher data for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((row, i) => (
                      <tr
                        key={row.teacherId}
                        className="border-b border-border/70 transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground">{row.teacherName}</div>
                          <div className="truncate text-xs text-muted-foreground">{row.email}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {row.course}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${scopeBadge(
                              row.genderScope,
                            )}`}
                          >
                            {row.genderScope}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-medium">
                          {row.students}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{row.assignments}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{row.submissions}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={`inline-flex min-w-[1.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              row.pending > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {row.pending}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                          {row.avgMarks == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            `${row.avgMarks}/100`
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight">Course summary</h2>
              <p className="text-xs text-muted-foreground">
                Enrollment split by course and gender
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">SR#</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold text-right">Batches</th>
                    <th className="px-4 py-3 font-semibold text-right">Students</th>
                    <th className="px-4 py-3 font-semibold text-right">Male</th>
                    <th className="px-4 py-3 font-semibold text-right">Female</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : courseRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No courses found.
                      </td>
                    </tr>
                  ) : (
                    courseRows.map((c, i) => (
                      <tr
                        key={c.courseId}
                        className="border-b border-border/70 transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3.5 font-semibold">{c.courseName}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{c.batches}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-medium">
                          {c.students}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-sky-800">
                            {c.male}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-flex rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-pink-800">
                            {c.female}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

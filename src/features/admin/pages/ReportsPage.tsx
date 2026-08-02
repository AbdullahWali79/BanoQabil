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
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { Card, CardContent } from '@/components/ui/card';
import { usePermission } from '@/hooks/usePermission';
import {
  createReportDoc,
  defaultTableStyles,
  lastTableY,
  paintFooters,
  paintReportHeader,
  paintSectionTitle,
  paintSummaryBar,
} from '@/lib/reportPdf';
import { downloadSystemReportPdf } from '@/lib/systemReportPdf';

type TeacherReport = {
  teacherId: string;
  profileId: string;
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

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(monthValue: string) {
  const [y, m] = monthValue.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label,
  };
}

export default function ReportsPage() {
  const { can: canPerm, denyMessage } = usePermission();
  const canExport = canPerm('can_export_pdf');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [teacherRows, setTeacherRows] = useState<TeacherReport[]>([]);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [showExport, setShowExport] = useState(false);
  const [exportType, setExportType] = useState<'teacher' | 'system'>('teacher');
  const [exportTeacherId, setExportTeacherId] = useState('all');
  const [exportMonth, setExportMonth] = useState(currentMonthValue());

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: teacherData, error: teacherError },
        { data: studentData, error: studentError },
        { data: courseData },
        { data: batchData },
        { count: pendingApprovals },
        { count: attendanceCount },
        { data: assignments, error: assignmentError },
      ] = await Promise.all([
        supabase
          .from('teachers')
          .select(
            'id, profile_id, profiles(full_name, email, status), teacher_courses(gender_scope, courses(name))',
          ),
        supabase.from('students').select('id, gender, course_id, batch_id'),
        supabase.from('courses').select('id, name'),
        supabase.from('batches').select('id, name, course_id, teacher_id'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Pending'),
        supabase.from('attendance').select('id', { count: 'exact', head: true }),
        supabase.from('assignments').select('id, teacher_id, batch_id, created_at'),
      ]);

      if (teacherError) throw teacherError;
      if (studentError) throw studentError;
      if (assignmentError) throw assignmentError;

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
          ? Math.round(graded.reduce((sum, s) => sum + (s.marks ?? 0), 0) / graded.length)
          : null;

        return {
          teacherId: teacher.id,
          profileId: teacher.profileId,
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

      setTeacherRows(report);
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
      toastError(err, 'Failed to load report');
      setTeacherRows([]);
      setOverview(emptyOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const teacherOptions = useMemo(
    () => teacherRows.map((t) => ({ id: t.teacherId, name: t.teacherName })),
    [teacherRows],
  );

  const handleExportTeacherReport = async () => {
    if (!exportMonth) {
      toastError('Select a month.');
      return;
    }
    setExporting(true);
    try {
      const bounds = monthBounds(exportMonth);
      const targets =
        exportTeacherId === 'all'
          ? teacherRows
          : teacherRows.filter((t) => t.teacherId === exportTeacherId);

      if (targets.length === 0) {
        toastError('No teachers found.');
        return;
      }

      const teacherKeys = targets.flatMap((t) => [t.teacherId, t.profileId]);

      const [{ data: monthAssignments }, { data: monthAttendance }] = await Promise.all([
        supabase
          .from('assignments')
          .select('id, teacher_id, created_at, title')
          .in('teacher_id', teacherKeys)
          .gte('created_at', bounds.startIso)
          .lte('created_at', bounds.endIso),
        supabase
          .from('attendance')
          .select('teacher_id, attendance_date, status')
          .in('teacher_id', targets.map((t) => t.teacherId))
          .gte('attendance_date', bounds.startDate)
          .lte('attendance_date', bounds.endDate),
      ]);

      const assignmentIds = (monthAssignments ?? []).map((a) => a.id);
      const submissionsByAssignment: Record<
        string,
        { total: number; graded: number; marksSum: number }
      > = {};
      if (assignmentIds.length > 0) {
        const { data: submissionRows } = await supabase
          .from('submissions')
          .select('assignment_id, marks')
          .in('assignment_id', assignmentIds);
        for (const row of submissionRows ?? []) {
          const cur = submissionsByAssignment[row.assignment_id] ?? {
            total: 0,
            graded: 0,
            marksSum: 0,
          };
          cur.total += 1;
          if (row.marks != null) {
            cur.graded += 1;
            cur.marksSum += Number(row.marks) || 0;
          }
          submissionsByAssignment[row.assignment_id] = cur;
        }
      }

      const rows = targets.map((t) => {
        const created = (monthAssignments ?? []).filter(
          (a) => a.teacher_id === t.teacherId || a.teacher_id === t.profileId,
        );
        let submissions = 0;
        let checked = 0;
        let marksSum = 0;
        for (const a of created) {
          const s = submissionsByAssignment[a.id];
          if (!s) continue;
          submissions += s.total;
          checked += s.graded;
          marksSum += s.marksSum;
        }
        const pending = Math.max(0, submissions - checked);
        const checkRate =
          submissions > 0 ? Math.round((checked / submissions) * 100) : null;
        const avgMarks = checked > 0 ? Math.round(marksSum / checked) : null;

        const attRows = (monthAttendance ?? []).filter((a) => a.teacher_id === t.teacherId);
        const attDates = new Set(attRows.map((a) => String(a.attendance_date)));
        const present = attRows.filter(
          (a) => a.status === 'Present' || a.status === 'Late',
        ).length;
        const absent = attRows.filter((a) => a.status === 'Absent').length;
        const marksGiven = attRows.length;

        return {
          name: t.teacherName,
          email: t.email,
          course: t.course,
          scope: t.genderScope,
          students: t.students,
          assignmentsCreated: created.length,
          submissions,
          checked,
          pending,
          checkRate,
          avgMarks,
          attendanceDays: attDates.size,
          attendanceMarks: marksGiven,
          present,
          absent,
        };
      });

      const totals = rows.reduce(
        (acc, r) => {
          acc.students += r.students;
          acc.assignments += r.assignmentsCreated;
          acc.submissions += r.submissions;
          acc.checked += r.checked;
          acc.pending += r.pending;
          acc.attDays += r.attendanceDays;
          acc.present += r.present;
          acc.absent += r.absent;
          return acc;
        },
        {
          students: 0,
          assignments: 0,
          submissions: 0,
          checked: 0,
          pending: 0,
          attDays: 0,
          present: 0,
          absent: 0,
        },
      );

      const { doc, autoTable } = await createReportDoc('landscape');

      paintReportHeader(doc, {
        title: 'Teacher Progress Report',
        subtitle: 'Assignments · grading · attendance',
        metaLeft: bounds.label,
        metaRight: new Date().toLocaleString(),
        theme: 'blue',
      });

      let y = paintSummaryBar(
        doc,
        34,
        [
          `Teachers ${rows.length}`,
          `Students ${totals.students}`,
          `Assign. ${totals.assignments}`,
          `Submit ${totals.submissions}`,
          `Checked ${totals.checked}`,
          `Pending ${totals.pending}`,
          `Att. days ${totals.attDays}`,
          `Present ${totals.present}`,
          `Absent ${totals.absent}`,
        ],
        'blue',
      );

      y = paintSectionTitle(
        doc,
        y,
        exportTeacherId === 'all' ? 'All teachers' : targets[0]?.teacherName || 'Teacher',
      );

      autoTable(doc, {
        startY: y + 2,
        head: [
          [
            '#',
            'Teacher',
            'Email',
            'Course',
            'Scope',
            'Students',
            'Assign.',
            'Submit',
            'Checked',
            'Pending',
            'Check %',
            'Avg marks',
            'Att. days',
            'Present',
            'Absent',
          ],
        ],
        body: rows.map((r, i) => [
          String(i + 1),
          r.name,
          r.email,
          r.course,
          r.scope,
          String(r.students),
          String(r.assignmentsCreated),
          String(r.submissions),
          String(r.checked),
          String(r.pending),
          r.checkRate == null ? '—' : `${r.checkRate}%`,
          r.avgMarks == null ? '—' : String(r.avgMarks),
          String(r.attendanceDays),
          String(r.present),
          String(r.absent),
        ]),
        ...defaultTableStyles('blue'),
        columnStyles: {
          1: { cellWidth: 32 },
          2: { cellWidth: 42 },
          3: { cellWidth: 34 },
        },
      });

      const finalY = lastTableY(doc, 70);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Assign. = created in month · Submit = student submissions · Checked = graded · Att. days = unique dates marked · Present includes Late.',
        14,
        finalY + 8,
      );

      paintFooters(doc, 'BanoQabil LMS · Admin · Teacher Report');

      const suffix = exportTeacherId === 'all' ? 'all-teachers' : 'teacher';
      doc.save(`banoqabil-teacher-report-${exportMonth}-${suffix}.pdf`);
      toastSuccess('Report downloaded.');
      setShowExport(false);
    } catch (err: unknown) {
      toastError(err, 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSystemReport = async () => {
    if (!exportMonth) {
      toastError('Select a month.');
      return;
    }
    setExporting(true);
    try {
      await downloadSystemReportPdf({
        monthValue: exportMonth,
        includeStaffPay: false,
        footerNote: 'BanoQabil LMS · Admin · System Report',
        theme: 'blue',
        filePrefix: 'banoqabil-system-report',
      });
      toastSuccess('System report downloaded.');
      setShowExport(false);
    } catch (err: unknown) {
      toastError(err, 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateExport = () => {
    if (!canExport) {
      toastError(denyMessage('can_export_pdf'));
      return;
    }
    if (exportType === 'system') void handleExportSystemReport();
    else void handleExportTeacherReport();
  };

  const statCards = [
    { label: 'Teachers', value: overview.teachers, icon: Users, tone: 'bg-sky-500/10 text-sky-700' },
    {
      label: 'Students',
      value: overview.students,
      icon: GraduationCap,
      tone: 'bg-emerald-500/10 text-emerald-700',
    },
    {
      label: 'Courses',
      value: overview.courses,
      icon: BookOpen,
      tone: 'bg-indigo-500/10 text-indigo-700',
    },
    {
      label: 'Batches',
      value: overview.batches,
      icon: Layers,
      tone: 'bg-teal-500/10 text-teal-700',
    },
    {
      label: 'Assignments',
      value: overview.assignments,
      icon: ClipboardCheck,
      tone: 'bg-blue-500/10 text-blue-700',
    },
    {
      label: 'Submissions',
      value: overview.submissions,
      icon: FileDown,
      tone: 'bg-slate-500/10 text-slate-700',
    },
    {
      label: 'Pending grades',
      value: overview.pendingGrades,
      icon: ClipboardCheck,
      tone: 'bg-amber-500/10 text-amber-700',
    },
    {
      label: 'Pending approvals',
      value: overview.pendingApprovals,
      icon: UserCheck,
      tone: 'bg-rose-500/10 text-rose-700',
    },
  ];

  const scopeBadge = (scope: string) => {
    const s = scope.toLowerCase();
    if (s === 'male') return 'bg-sky-100 text-sky-800';
    if (s === 'female') return 'bg-pink-100 text-pink-800';
    if (s === 'both') return 'bg-violet-100 text-violet-800';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-full space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Teacher progress & full system reports. Fee ledgers export from Student Fees.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              if (!canExport) {
                toastError(denyMessage('can_export_pdf'));
                return;
              }
              setShowExport(true);
            }}
            disabled={loading}
          >
            <FileDown className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{loading ? '…' : s.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="border-b bg-muted/20 px-5 py-4">
            <h2 className="text-base font-semibold">Teacher performance</h2>
            <p className="text-xs text-muted-foreground">
              {teacherRows.length} teacher{teacherRows.length === 1 ? '' : 's'} · live overview
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Teacher</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Scope</th>
                  <th className="px-4 py-3 text-right font-semibold">Students</th>
                  <th className="px-4 py-3 text-right font-semibold">Assignments</th>
                  <th className="px-4 py-3 text-right font-semibold">Checked</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                      Loading report...
                    </td>
                  </tr>
                ) : teacherRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                      No teacher data.
                    </td>
                  </tr>
                ) : (
                  teacherRows.map((row, i) => (
                    <tr key={row.teacherId} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{row.teacherName}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                          {row.course}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${scopeBadge(
                            row.genderScope,
                          )}`}
                        >
                          {row.genderScope}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {row.students}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.assignments}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.graded}</td>
                      <td className="px-4 py-3 text-right">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Export Report</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {exportType === 'system'
                      ? 'Full institute PDF — overview, courses, teachers, fees & attention lists.'
                      : 'Teacher progress PDF — email, assignments, check rate, marks & attendance.'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowExport(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Report type</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'teacher' | 'system')}
                >
                  <option value="teacher">Teacher Progress</option>
                  <option value="system">Full System Report</option>
                </select>
                {exportType === 'system' ? (
                  <p className="text-xs text-muted-foreground">
                    Includes KPIs, enrollment, month activity, fee summary, teachers & pending lists.
                    Detailed fee ledgers stay on Student Fees.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Student fee reports download from Student Fees page.
                  </p>
                )}
              </div>

              {exportType === 'teacher' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Teacher</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={exportTeacherId}
                    onChange={(e) => setExportTeacherId(e.target.value)}
                  >
                    <option value="all">All Teachers</option>
                    {teacherOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button className="gap-2" disabled={exporting} onClick={handleGenerateExport}>
                  {exporting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {exporting ? 'Generating…' : 'Generate & Download'}
                </Button>
                <Button variant="ghost" onClick={() => setShowExport(false)} disabled={exporting}>
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

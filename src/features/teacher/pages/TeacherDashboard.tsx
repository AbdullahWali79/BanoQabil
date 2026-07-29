import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  BookOpen,
  ClipboardCheck,
  BarChart2,
  ArrowRight,
  GraduationCap,
  PenLine,
  CalendarCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getTeacherAssignedCourse,
  getTeacherBatches,
  getTeacherEntityId,
  getTeacherStudents,
  relationOne,
  resolveStudentGender,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

type AssignedCourse = {
  id: string;
  name: string;
  description?: string | null;
  genderScope?: 'Male' | 'Female' | 'Both' | null;
};

type DashStats = {
  totalStudents: number;
  female: number;
  male: number;
  unknown: number;
  totalAssignments: number;
  pendingSubmissions: number;
  gradedSubmissions: number;
  openAssignments: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  attendanceMarked: number;
};

type DayPresent = { date: string; present: number; total: number; pct: number };

const MANAGEMENT_ACTIONS = [
  {
    to: '/dashboard/my-class',
    title: 'My Classes',
    description: 'Full student records with Male/Female filters and details.',
    icon: Users,
  },
  {
    to: '/dashboard/assignments',
    title: 'Assignments',
    description: 'Create assignments, review submissions, and grade work.',
    icon: ClipboardCheck,
  },
  {
    to: '/dashboard/attendance',
    title: 'Attendance',
    description: 'Mark or edit attendance for any date — Female/Male separately.',
    icon: CalendarCheck,
  },
  {
    to: '/dashboard/notifications',
    title: 'Notifications',
    description: 'Search a student or notify the whole class at once.',
    icon: PenLine,
  },
  {
    to: '/dashboard/progress',
    title: 'Student Progress',
    description: 'View submissions, grades, and attendance % together.',
    icon: BarChart2,
  },
] as const;

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [course, setCourse] = useState<AssignedCourse | null>(null);
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [statsDate, setStatsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayStats, setDayStats] = useState({ present: 0, absent: 0, late: 0, excused: 0, marked: 0 });
  const [recentDays, setRecentDays] = useState<DayPresent[]>([]);
  const [stats, setStats] = useState<DashStats>({
    totalStudents: 0,
    female: 0,
    male: 0,
    unknown: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    gradedSubmissions: 0,
    openAssignments: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    attendanceMarked: 0,
  });

  useEffect(() => {
    async function loadDashboard() {
      if (!user?.id) return;
      setLoading(true);

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .limit(1);
      if (profileRows?.[0]?.full_name) setProfileName(profileRows[0].full_name);

      try {
        const assignedCourse = await getTeacherAssignedCourse(user.id);
        setCourse(assignedCourse);

        const batches = await getTeacherBatches(user.id);
        setBatchNames(batches.map((b) => b.display_name).filter(Boolean));

        const batchIds = batches.map((b) => b.id);
        const teacherId = await getTeacherEntityId(user.id);
        const teacherKeys = [user.id, teacherId].filter(Boolean) as string[];

        let students: any[] = [];
        try {
          students = await getTeacherStudents(
            user.id,
            'id, gender, batches(name)',
          );
        } catch {
          students = [];
        }

        let female = 0;
        let male = 0;
        let unknown = 0;
        for (const s of students) {
          const g = resolveStudentGender({
            gender: s.gender,
            batchName: relationOne(s.batches)?.name,
          });
          if (g === 'Female') female += 1;
          else if (g === 'Male') male += 1;
          else unknown += 1;
        }

        const studentIds = students.map((s) => s.id);

        let assignmentsCount = 0;
        let openAssignments = 0;
        let assignmentIds: string[] = [];

        if (teacherKeys.length > 0) {
          const { data: assignmentRows, count } = await supabase
            .from('assignments')
            .select('id, status', { count: 'exact' })
            .in('teacher_id', teacherKeys);
          assignmentsCount = count || 0;
          assignmentIds = (assignmentRows ?? []).map((a) => a.id);
          openAssignments = (assignmentRows ?? []).filter(
            (a) => !a.status || a.status === 'Open',
          ).length;
        }

        if (batchIds.length > 0 && assignmentIds.length === 0) {
          const { data: batchAssignments, count } = await supabase
            .from('assignments')
            .select('id, status', { count: 'exact' })
            .in('batch_id', batchIds);
          assignmentsCount = count || 0;
          assignmentIds = (batchAssignments ?? []).map((a) => a.id);
          openAssignments = (batchAssignments ?? []).filter(
            (a) => !a.status || a.status === 'Open',
          ).length;
        }

        let pendingSubmissions = 0;
        let gradedSubmissions = 0;
        if (assignmentIds.length > 0) {
          const [{ count: pending }, { count: graded }] = await Promise.all([
            supabase
              .from('submissions')
              .select('id', { count: 'exact', head: true })
              .in('assignment_id', assignmentIds)
              .is('marks', null),
            supabase
              .from('submissions')
              .select('id', { count: 'exact', head: true })
              .in('assignment_id', assignmentIds)
              .not('marks', 'is', null),
          ]);
          pendingSubmissions = pending || 0;
          gradedSubmissions = graded || 0;
        }

        // Selected date attendance
        let presentToday = 0;
        let absentToday = 0;
        let lateToday = 0;
        let attendanceMarked = 0;
        if (studentIds.length > 0) {
          const { data: dayAtt } = await supabase
            .from('attendance')
            .select('status')
            .eq('attendance_date', statsDate)
            .in('student_id', studentIds);
          for (const row of dayAtt ?? []) {
            attendanceMarked += 1;
            if (row.status === 'Present') presentToday += 1;
            else if (row.status === 'Absent') absentToday += 1;
            else if (row.status === 'Late') lateToday += 1;
          }

          // Last 7 days present trend
          const from = new Date(statsDate);
          from.setDate(from.getDate() - 6);
          const fromStr = from.toISOString().slice(0, 10);
          const { data: weekAtt } = await supabase
            .from('attendance')
            .select('attendance_date, status')
            .gte('attendance_date', fromStr)
            .lte('attendance_date', statsDate)
            .in('student_id', studentIds);

          const byDate: Record<string, { present: number; total: number }> = {};
          for (let i = 0; i < 7; i++) {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            byDate[key] = { present: 0, total: 0 };
          }
          for (const row of weekAtt ?? []) {
            if (!byDate[row.attendance_date]) {
              byDate[row.attendance_date] = { present: 0, total: 0 };
            }
            byDate[row.attendance_date].total += 1;
            if (row.status === 'Present' || row.status === 'Late') {
              byDate[row.attendance_date].present += 1;
            }
          }
          const days: DayPresent[] = Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({
              date,
              present: v.present,
              total: v.total,
              pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
            }));
          setRecentDays(days);
          setDayStats({
            present: presentToday,
            absent: absentToday,
            late: lateToday,
            excused: Math.max(
              0,
              attendanceMarked - presentToday - absentToday - lateToday,
            ),
            marked: attendanceMarked,
          });
        } else {
          setRecentDays([]);
          setDayStats({ present: 0, absent: 0, late: 0, excused: 0, marked: 0 });
        }

        setStats({
          totalStudents: students.length,
          female,
          male,
          unknown,
          totalAssignments: assignmentsCount,
          pendingSubmissions,
          gradedSubmissions,
          openAssignments,
          presentToday,
          absentToday,
          lateToday,
          attendanceMarked,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user?.id, statsDate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TeacherAssignmentGate courseName={course?.name} genderScope={course?.genderScope ?? null} soft>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {profileName || user?.email || 'Teacher'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Class overview — students, attendance by date, and your teaching tools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/attendance">Mark Attendance</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/assignments">Create Assignment</Link>
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                You are teacher of
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                {course?.name || 'No course assigned'}
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                {!course
                  ? 'No course assigned — contact admin. You will not see any students yet.'
                  : !course.genderScope
                    ? 'Course assigned, but class gender is not set (Male / Female / Both). No students will show until admin sets it.'
                    : `You teach ${
                        course.genderScope === 'Male'
                          ? 'Only Male'
                          : course.genderScope === 'Female'
                            ? 'Only Female'
                            : 'Both Male & Female'
                      } students of this course.`}
              </p>
              {batchNames.length > 0 && (
                <p className="text-sm mt-3">
                  <span className="text-muted-foreground">Batches: </span>
                  <span className="font-medium">{batchNames.join(', ')}</span>
                </p>
              )}
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link to="/dashboard/my-class">
              <Users className="mr-2 h-4 w-4" />
              Open My Classes
            </Link>
          </Button>
        </div>
      </section>

      {/* Student gender breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Female</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.female}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Male</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.male}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unknown Gender</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unknown}</div>
          </CardContent>
        </Card>
      </div>

      {/* Date-wise attendance */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Attendance by date</h2>
            <p className="text-sm text-muted-foreground">
              Pick any date to see present / absent totals. You can edit past dates in Attendance.
            </p>
          </div>
          <Input
            type="date"
            className="w-auto"
            value={statsDate}
            onChange={(e) => setStatsDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="text-2xl font-bold text-green-600">{dayStats.present}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Absent</p>
              <p className="text-2xl font-bold text-red-600">{dayStats.absent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Late</p>
              <p className="text-2xl font-bold">{dayStats.late}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Excused</p>
              <p className="text-2xl font-bold">{dayStats.excused}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Marked / Class</p>
              <p className="text-2xl font-bold">
                {dayStats.marked}/{stats.totalStudents}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 7 days — present count</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Present</th>
                    <th className="px-4 py-2">Marked</th>
                    <th className="px-4 py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDays.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-muted-foreground text-center">
                        No attendance data yet.
                      </td>
                    </tr>
                  ) : (
                    recentDays.map((d) => (
                      <tr key={d.date} className="border-b">
                        <td className="px-4 py-2 font-medium">{d.date}</td>
                        <td className="px-4 py-2">{d.present}</td>
                        <td className="px-4 py-2">{d.total}</td>
                        <td className="px-4 py-2">{d.total ? `${d.pct}%` : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Work stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assignments</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Grade</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gradedSubmissions}</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Quick actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {MANAGEMENT_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                to={action.to}
                className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      </TeacherAssignmentGate>
    </div>
  );
}

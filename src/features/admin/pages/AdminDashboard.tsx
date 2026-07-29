import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  Users,
  BookOpen,
  Clock,
  FileText,
  CheckCircle,
  Plus,
  GraduationCap,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { relationOne } from '@/features/teacher/utils/teacherData';

type WeekBar = { name: string; value: number };

type PendingPreview = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
};

type DashboardStats = {
  teachers: number;
  teachersApproved: number;
  students: number;
  studentsApproved: number;
  courses: number;
  batches: number;
  pendingStudents: number;
  assignments: number;
  submissions: number;
};

function weekBucketsForMonth(dates: string[]): WeekBar[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const buckets = [
    { name: 'Week 1', start: 1, end: 7, value: 0 },
    { name: 'Week 2', start: 8, end: 14, value: 0 },
    { name: 'Week 3', start: 15, end: 21, value: 0 },
    {
      name: 'Week 4',
      start: 22,
      end: daysInMonth,
      value: 0,
    },
  ];

  for (const raw of dates) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    const bucket = buckets.find((b) => day >= b.start && day <= b.end);
    if (bucket) bucket.value += 1;
  }

  return buckets.map(({ name, value }) => ({ name, value }));
}

function CSSBarChart({ data }: { data: WeekBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-48 items-end gap-4 px-4 pt-4">
      {data.map((item) => (
        <div key={item.name} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-primary">{item.value}</span>
          <div className="flex w-full items-end justify-center">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-primary to-primary/60 transition-all duration-700"
              style={{ height: `${Math.max(4, (item.value / max) * 140)}px` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    teachers: 0,
    teachersApproved: 0,
    students: 0,
    studentsApproved: 0,
    courses: 0,
    batches: 0,
    pendingStudents: 0,
    assignments: 0,
    submissions: 0,
  });
  const [chartData, setChartData] = useState<WeekBar[]>([
    { name: 'Week 1', value: 0 },
    { name: 'Week 2', value: 0 },
    { name: 'Week 3', value: 0 },
    { name: 'Week 4', value: 0 },
  ]);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user?.id) {
      void supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]?.full_name) setProfileName(data[0].full_name);
        });
    }

    async function fetchDashboard() {
      setLoading(true);
      setErrorMessage('');
      try {
        const { data: roles } = await supabase.from('roles').select('id, name');
        const teacherRoleId = roles?.find((r) => r.name === 'Teacher')?.id ?? null;
        const studentRoleId = roles?.find((r) => r.name === 'Student')?.id ?? null;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

        const [
          teachersAll,
          teachersApproved,
          studentsAll,
          studentsApproved,
          courses,
          batches,
          pendingStudents,
          assignments,
          submissions,
          monthAssignments,
          pendingRows,
        ] = await Promise.all([
          supabase.from('teachers').select('id', { count: 'exact', head: true }),
          teacherRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', teacherRoleId)
                .eq('status', 'Approved')
            : Promise.resolve({ count: 0 }),
          supabase.from('students').select('id', { count: 'exact', head: true }),
          studentRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', studentRoleId)
                .eq('status', 'Approved')
            : Promise.resolve({ count: 0 }),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('batches').select('id', { count: 'exact', head: true }),
          studentRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', studentRoleId)
                .eq('status', 'Pending')
            : Promise.resolve({ count: 0 }),
          supabase.from('assignments').select('id', { count: 'exact', head: true }),
          supabase.from('submissions').select('id', { count: 'exact', head: true }),
          supabase
            .from('assignments')
            .select('created_at')
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd),
          studentRoleId
            ? supabase
                .from('profiles')
                .select('id, full_name, email, created_at, roles!inner(name)')
                .eq('status', 'Pending')
                .eq('roles.name', 'Student')
                .order('created_at', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [], error: null }),
        ]);

        setStats({
          teachers: teachersAll.count ?? 0,
          teachersApproved: teachersApproved.count ?? 0,
          students: studentsAll.count ?? 0,
          studentsApproved: studentsApproved.count ?? 0,
          courses: courses.count ?? 0,
          batches: batches.count ?? 0,
          pendingStudents: pendingStudents.count ?? 0,
          assignments: assignments.count ?? 0,
          submissions: submissions.count ?? 0,
        });

        const assignmentDates = (monthAssignments.data ?? [])
          .map((row) => row.created_at as string)
          .filter(Boolean);
        setChartData(weekBucketsForMonth(assignmentDates));

        if (pendingRows && 'error' in pendingRows && pendingRows.error) {
          // Fallback without roles filter join
          const fallback = await supabase
            .from('profiles')
            .select('id, full_name, email, created_at, role_id, roles(name)')
            .eq('status', 'Pending')
            .order('created_at', { ascending: false })
            .limit(20);
          const list = (fallback.data ?? [])
            .map((row) => {
              const roleRel = relationOne<{ name?: string }>(row.roles as { name?: string } | { name?: string }[] | null);
              if (roleRel?.name !== 'Student' && row.role_id !== studentRoleId) return null;
              return {
                id: row.id as string,
                full_name: (row.full_name as string) || 'Unknown',
                email: (row.email as string) || '',
                created_at: row.created_at
                  ? new Date(row.created_at as string).toLocaleDateString()
                  : '',
              };
            })
            .filter(Boolean)
            .slice(0, 5) as PendingPreview[];
          setPendingPreview(list);
        } else {
          const list = ((pendingRows as { data?: Array<Record<string, unknown>> }).data ?? []).map(
            (row) => ({
              id: String(row.id),
              full_name: String(row.full_name || 'Unknown'),
              email: String(row.email || ''),
              created_at: row.created_at
                ? new Date(String(row.created_at)).toLocaleDateString()
                : '',
            }),
          );
          setPendingPreview(list);
        }
      } catch (err: unknown) {
        console.error('Error fetching admin dashboard:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }

    void fetchDashboard();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const pending = stats.pendingStudents;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back,{' '}
            <span className="font-semibold text-primary">
              {profileName || user?.email || 'Admin'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard/approvals">
              <CheckCircle className="h-4 w-4" />
              Approvals
              {pending > 0 ? (
                <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                  {pending}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/dashboard/teachers">
              <Plus className="h-4 w-4" /> Add Teacher
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-2">
            <Link to="/dashboard/courses">
              <Plus className="h-4 w-4" /> Add Course
            </Link>
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Teachers"
          value={stats.teachers}
          hint={`${stats.teachersApproved} approved`}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          gradient="from-blue-500/10 to-blue-500/5"
        />
        <StatCard
          title="Students"
          value={stats.students}
          hint={`${stats.studentsApproved} approved`}
          icon={<GraduationCap className="h-5 w-5 text-green-500" />}
          gradient="from-green-500/10 to-green-500/5"
        />
        <StatCard
          title="Courses"
          value={stats.courses}
          icon={<BookOpen className="h-5 w-5 text-violet-500" />}
          gradient="from-violet-500/10 to-violet-500/5"
        />
        <StatCard
          title="Batches"
          value={stats.batches}
          icon={<Layers className="h-5 w-5 text-sky-500" />}
          gradient="from-sky-500/10 to-sky-500/5"
        />
        <StatCard
          title="Pending Students"
          value={pending}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          gradient="from-amber-500/10 to-amber-500/5"
          highlight={pending > 0}
        />
        <StatCard
          title="Assignments"
          value={stats.assignments}
          hint={`${stats.submissions} submissions`}
          icon={<FileText className="h-5 w-5 text-rose-500" />}
          gradient="from-rose-500/10 to-rose-500/5"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Assignments This Month</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Real counts from assignment created dates
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {chartData.every((d) => d.value === 0) ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No assignments created this month yet.
              </div>
            ) : (
              <CSSBarChart data={chartData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pending Student Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {pending === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500/50" />
                <p className="font-medium text-green-600">All caught up!</p>
                <p className="mt-1 text-sm">No pending student requests.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {pending} pending {pending === 1 ? 'student' : 'students'}
                  </p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                    Teacher approvals are handled by Super Admin
                  </p>
                </div>
                <ul className="space-y-2">
                  {pendingPreview.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <p className="font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <Link to="/dashboard/approvals">Review Student Approvals</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{stats.teachers + stats.students}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.teachers} teachers · {stats.students} students
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Courses & Batches</p>
            <p className="text-2xl font-bold">{stats.courses}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stats.batches} batches total</p>
          </CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-rose-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Assignments & Submissions</p>
            <p className="text-2xl font-bold">{stats.assignments}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.submissions} student submissions
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon,
  gradient,
  highlight = false,
}: {
  title: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  gradient: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`bg-gradient-to-br ${gradient} border ${
        highlight ? 'border-amber-300 dark:border-amber-700' : ''
      }`}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-background/80 p-2 shadow-sm">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Banknote,
  GraduationCap,
  KeyRound,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { relationOne } from '@/features/teacher/utils/teacherData';

type DashboardStats = {
  totalUsers: number;
  students: number;
  studentsApproved: number;
  teachers: number;
  admins: number;
  roles: number;
  pendingTeachers: number;
  pendingFeeTotal: number;
  pendingFeeStudents: number;
};

const emptyStats: DashboardStats = {
  totalUsers: 0,
  students: 0,
  studentsApproved: 0,
  teachers: 0,
  admins: 0,
  roles: 0,
  pendingTeachers: 0,
  pendingFeeTotal: 0,
  pendingFeeStudents: 0,
};

function money(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

async function computePendingFee(): Promise<{ total: number; studentsWithPending: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const selectWithFree = `
        id,
        profiles!inner(status),
        courses(initial_fee, monthly_fee, is_free)
      `;
  const selectWithoutFree = `
        id,
        profiles!inner(status),
        courses(initial_fee, monthly_fee)
      `;

  let studentRows: unknown[] | null = null;
  const first = await supabase.from('students').select(selectWithFree);
  if (first.error && /is_free/i.test(first.error.message)) {
    const second = await supabase.from('students').select(selectWithoutFree);
    if (second.error) return { total: 0, studentsWithPending: 0 };
    studentRows = second.data;
  } else if (first.error) {
    return { total: 0, studentsWithPending: 0 };
  } else {
    studentRows = first.data;
  }

  const { data: payRows } = await supabase
    .from('student_fee_payments')
    .select('student_id, payment_type, year, month, amount, status')
    .eq('status', 'Paid');

  const paysByStudent = new Map<string, Array<Record<string, unknown>>>();
  for (const p of payRows ?? []) {
    const id = String((p as { student_id: string }).student_id);
    const list = paysByStudent.get(id) ?? [];
    list.push(p as Record<string, unknown>);
    paysByStudent.set(id, list);
  }

  let total = 0;
  let studentsWithPending = 0;

  for (const row of (studentRows ?? []) as Array<Record<string, unknown>>) {
    const profile = relationOne(
      row.profiles as { status?: string | null } | { status?: string | null }[] | null,
    );
    if (profile?.status !== 'Approved') continue;

    const course = relationOne(
      row.courses as
        | {
            initial_fee?: number | null;
            monthly_fee?: number | null;
            is_free?: boolean | null;
          }
        | {
            initial_fee?: number | null;
            monthly_fee?: number | null;
            is_free?: boolean | null;
          }[]
        | null,
    );

    const isFree = Boolean(course?.is_free);
    const initialFee = isFree ? 0 : money(course?.initial_fee);
    const monthlyFee = isFree ? 0 : money(course?.monthly_fee);
    if (initialFee <= 0 && monthlyFee <= 0) continue;

    const pays = paysByStudent.get(String(row.id)) ?? [];
    const paidInitial = pays
      .filter((p) => p.payment_type === 'Initial')
      .reduce((s, p) => s + money(p.amount), 0);
    const paidMonth = pays
      .filter(
        (p) =>
          p.payment_type === 'Monthly' &&
          Number(p.year) === year &&
          Number(p.month) === month,
      )
      .reduce((s, p) => s + money(p.amount), 0);

    const pending =
      Math.max(0, initialFee - paidInitial) + Math.max(0, monthlyFee - paidMonth);

    if (pending > 0) {
      total += pending;
      studentsWithPending += 1;
    }
  }

  return { total, studentsWithPending };
}

function StatCard({
  title,
  value,
  hint,
  icon,
  highlight,
  to,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  highlight?: boolean;
  to?: string;
}) {
  const inner = (
    <Card
      className={`h-full transition-colors ${
        highlight ? 'border-amber-200 bg-amber-50/50' : ''
      } ${to ? 'hover:border-primary/40 hover:bg-muted/30' : ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-bold tabular-nums ${
            highlight ? 'text-amber-800' : ''
          }`}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function SuperAdminDashboard() {
  const { user } = useAuthStore();
  const [profileName, setProfileName] = useState('');
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage('');
      try {
        if (user?.id) {
          const { data: me } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .limit(1);
          if (!cancelled && me?.[0]?.full_name) setProfileName(me[0].full_name);
        }

        const { data: roles } = await supabase.from('roles').select('id, name');
        const roleByName = Object.fromEntries((roles ?? []).map((r) => [r.name, r.id]));
        const studentRoleId = roleByName['Student'];
        const teacherRoleId = roleByName['Teacher'];
        const adminRoleId = roleByName['Admin'];

        const [
          usersRes,
          studentsRes,
          studentsApprovedRes,
          teachersRes,
          adminsRes,
          pendingTeachersRes,
          fee,
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          studentRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', studentRoleId)
            : Promise.resolve({ count: 0 }),
          studentRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', studentRoleId)
                .eq('status', 'Approved')
            : Promise.resolve({ count: 0 }),
          teacherRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', teacherRoleId)
            : Promise.resolve({ count: 0 }),
          adminRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', adminRoleId)
            : Promise.resolve({ count: 0 }),
          teacherRoleId
            ? supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role_id', teacherRoleId)
                .eq('status', 'Pending')
            : Promise.resolve({ count: 0 }),
          computePendingFee(),
        ]);

        if (cancelled) return;

        setStats({
          totalUsers: usersRes.count ?? 0,
          students: studentsRes.count ?? 0,
          studentsApproved: studentsApprovedRes.count ?? 0,
          teachers: teachersRes.count ?? 0,
          admins: adminsRes.count ?? 0,
          roles: roles?.length ?? 0,
          pendingTeachers: pendingTeachersRes.count ?? 0,
          pendingFeeTotal: fee.total,
          pendingFeeStudents: fee.studentsWithPending,
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load dashboard.');
          setStats(emptyStats);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const monthLabel = new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Super Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome{profileName ? `, ${profileName}` : ''}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Platform overview — users, students, fees, and system controls.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading stats…</p>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total users"
          value={loading ? '—' : stats.totalUsers.toLocaleString()}
          hint="All profiles in the system"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Total students"
          value={loading ? '—' : stats.students.toLocaleString()}
          hint={`${stats.studentsApproved.toLocaleString()} approved`}
          icon={<UserRound className="h-4 w-4" />}
          to="/dashboard/students"
        />
        <StatCard
          title="Pending fee"
          value={loading ? '—' : `Rs ${stats.pendingFeeTotal.toLocaleString()}`}
          hint={
            loading
              ? undefined
              : `${stats.pendingFeeStudents} student${stats.pendingFeeStudents === 1 ? '' : 's'} · ${monthLabel}`
          }
          icon={<Receipt className="h-4 w-4" />}
          highlight={!loading && stats.pendingFeeTotal > 0}
          to="/dashboard/fees"
        />
        <StatCard
          title="Teachers"
          value={loading ? '—' : stats.teachers.toLocaleString()}
          hint={
            stats.pendingTeachers > 0
              ? `${stats.pendingTeachers} pending approval`
              : 'All teacher accounts'
          }
          icon={<GraduationCap className="h-4 w-4" />}
          highlight={!loading && stats.pendingTeachers > 0}
          to="/dashboard/teachers"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title="Admins"
          value={loading ? '—' : stats.admins.toLocaleString()}
          hint="Operational Admin accounts"
          icon={<Shield className="h-4 w-4" />}
          to="/dashboard/admins"
        />
        <StatCard
          title="System roles"
          value={loading ? '—' : stats.roles.toLocaleString()}
          hint="Defined in the LMS"
          icon={<KeyRound className="h-4 w-4" />}
          to="/dashboard/roles"
        />
        <StatCard
          title="Your role"
          value="Super Admin"
          hint="Full platform access"
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Student Fees</h2>
            <p className="text-sm text-muted-foreground">
              View pending fee, record payments, and send WhatsApp reminders.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/fees" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Open Student Fees
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Manage Admins</h2>
            <p className="text-sm text-muted-foreground">
              Add admins, change email/password, set status, permissions, or remove accounts.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/admins" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Open Admins
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Staff Pay</h2>
            <p className="text-sm text-muted-foreground">
              Monthly pay for teachers, admins, cleaners and other staff.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/staff-pay" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Open Staff Pay
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Manage Teachers</h2>
            <p className="text-sm text-muted-foreground">
              View all teachers, edit credentials, change status, or delete accounts.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/teachers" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Open Teachers
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Teacher Approvals</h2>
            <p className="text-sm text-muted-foreground">
              Only Super Admin can approve, reject, or suspend teacher accounts.
              {stats.pendingTeachers > 0
                ? ` ${stats.pendingTeachers} waiting now.`
                : ''}
            </p>
            <Button asChild className="w-fit" variant="outline">
              <Link to="/dashboard/approvals" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Review Approvals
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Update your Super Admin profile and password.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Open Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

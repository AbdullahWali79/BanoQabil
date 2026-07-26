import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Users, BookOpen, Clock, FileText, CheckCircle, Plus, GraduationCap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router';

// Pure CSS/Tailwind bar chart — no external library needed!
const chartData = [
  { name: 'Week 1', value: 12, max: 25 },
  { name: 'Week 2', value: 19, max: 25 },
  { name: 'Week 3', value: 15, max: 25 },
  { name: 'Week 4', value: 22, max: 25 },
];

function CSSBarChart() {
  return (
    <div className="flex items-end gap-4 h-48 px-4 pt-4">
      {chartData.map((item) => (
        <div key={item.name} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-primary">{item.value}</span>
          <div className="w-full flex items-end justify-center">
            <div
              className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all duration-700 hover:from-primary/80 hover:to-purple-500 cursor-pointer"
              style={{ height: `${(item.value / item.max) * 140}px` }}
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
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    courses: 0,
    pending: 0,
    assignments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    // Fetch display name from profiles
    if (user?.id) {
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfileName(data.full_name); });
    }

    async function fetchStats() {
      try {
        // Fetch role IDs first
        const { data: roles } = await supabase.from('roles').select('id, name');
        const teacherRoleId = roles?.find(r => r.name === 'Teacher')?.id;
        const studentRoleId = roles?.find(r => r.name === 'Student')?.id;

        const [
          { count: teachers },
          { count: students },
          { count: courses },
          { count: pending },
          { count: assignments },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Approved').eq('role_id', teacherRoleId),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Approved').eq('role_id', studentRoleId),
          supabase.from('courses').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
          supabase.from('assignments').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          teachers: teachers || 0,
          students: students || 0,
          courses: courses || 0,
          pending: pending || 0,
          assignments: assignments || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, <span className="text-primary font-semibold">{profileName || user?.email || 'Admin'}</span>! 👋
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard/approvals"><CheckCircle className="w-4 h-4" /> Approvals {stats.pending > 0 && <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-1.5 text-xs">{stats.pending}</span>}</Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/dashboard/teachers"><Plus className="w-4 h-4" /> Add Teacher</Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-2">
            <Link to="/dashboard/courses"><Plus className="w-4 h-4" /> Add Course</Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Teachers" value={stats.teachers} icon={<Users className="w-5 h-5 text-blue-500" />} gradient="from-blue-500/10 to-blue-500/5" />
        <StatCard title="Students" value={stats.students} icon={<GraduationCap className="w-5 h-5 text-green-500" />} gradient="from-green-500/10 to-green-500/5" />
        <StatCard title="Courses" value={stats.courses} icon={<BookOpen className="w-5 h-5 text-purple-500" />} gradient="from-purple-500/10 to-purple-500/5" />
        <StatCard title="Pending" value={stats.pending} icon={<Clock className="w-5 h-5 text-amber-500" />} gradient="from-amber-500/10 to-amber-500/5" highlight={stats.pending > 0} />
        <StatCard title="Assignments" value={stats.assignments} icon={<FileText className="w-5 h-5 text-rose-500" />} gradient="from-rose-500/10 to-rose-500/5" />
      </div>

      {/* Chart & Pending Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Assignments This Month</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CSSBarChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pending === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
                <p className="font-medium text-green-600">All caught up!</p>
                <p className="text-sm mt-1">No pending requests.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {stats.pending} pending {stats.pending === 1 ? 'request' : 'requests'}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    New users waiting for your approval
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link to="/dashboard/approvals">Review All Approvals</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{stats.teachers + stats.students}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.teachers} teachers · {stats.students} students</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Courses</p>
            <p className="text-2xl font-bold">{stats.courses}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all batches</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Assignments</p>
            <p className="text-2xl font-bold">{stats.assignments}</p>
            <p className="text-xs text-muted-foreground mt-1">Created by all teachers</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, gradient, highlight = false }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border ${highlight ? 'border-amber-300 dark:border-amber-700' : ''}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 bg-background/80 rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

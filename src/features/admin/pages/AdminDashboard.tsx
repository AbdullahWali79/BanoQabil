import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, BookOpen, Clock, FileText, CheckCircle, Plus, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const mockChartData = [
  { name: 'Week 1', assignments: 12 },
  { name: 'Week 2', assignments: 19 },
  { name: 'Week 3', assignments: 15 },
  { name: 'Week 4', assignments: 22 },
];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    courses: 0,
    pending: 0,
    assignments: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          { count: teachers },
          { count: students },
          { count: courses },
          { count: pending },
          { count: assignments }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Approved').eq('role_id', 3), // Assuming 3 is Teacher
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Approved').eq('role_id', 4), // Assuming 4 is Student
          supabase.from('courses').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
          supabase.from('assignments').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          teachers: teachers || 0,
          students: students || 0,
          courses: courses || 0,
          pending: pending || 0,
          assignments: assignments || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back, {user?.user_metadata?.full_name || 'Admin'}!</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2"><CheckCircle className="w-4 h-4" /> Approve Users</Button>
          <Button className="gap-2"><Plus className="w-4 h-4" /> Add Teacher</Button>
          <Button variant="secondary" className="gap-2"><Plus className="w-4 h-4" /> Add Course</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Teachers" value={stats.teachers} icon={<Users className="w-6 h-6 text-blue-500" />} color="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Total Students" value={stats.students} icon={<GraduationCap className="w-6 h-6 text-green-500" />} color="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Total Courses" value={stats.courses} icon={<BookOpen className="w-6 h-6 text-purple-500" />} color="bg-purple-50 dark:bg-purple-900/20" />
        <StatCard title="Pending Approvals" value={stats.pending} icon={<Clock className="w-6 h-6 text-amber-500" />} color="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard title="Total Assignments" value={stats.assignments} icon={<FileText className="w-6 h-6 text-rose-500" />} color="bg-rose-50 dark:bg-rose-900/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Assignments Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="assignments" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Recent Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pending === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>All caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">You have {stats.pending} pending requests to review.</p>
                <Button className="w-full" variant="outline">Review Approvals</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <Card className={`border-none shadow-sm ${color}`}>
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

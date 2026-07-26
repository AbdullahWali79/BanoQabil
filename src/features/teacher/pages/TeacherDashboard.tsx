import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Stats {
  totalStudents: number;
  totalAssignments: number;
  pendingSubmissions: number;
  gradedSubmissions: number;
}

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    gradedSubmissions: 0
  });

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfileName(data.full_name); });
    }
    async function loadDashboard() {
      if (!user) return;
      try {
        const { data: batches } = await supabase
          .from('batches')
          .select('id')
          .eq('teacher_id', user.id);

        const batchIds = batches?.map(b => b.id) || [];
        
        let totalStudents = 0;
        if (batchIds.length > 0) {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact' })
            .in('batch_id', batchIds);
          totalStudents = count || 0;
        }

        const { count: assignmentsCount } = await supabase
          .from('assignments')
          .select('id', { count: 'exact' })
          .eq('teacher_id', user.id);

        setStats({
          totalStudents,
          totalAssignments: assignmentsCount || 0,
          pendingSubmissions: 0, // Mock
          gradedSubmissions: 0, // Mock
        });
      } catch (error) {
        console.error('Error fetching dashboard stats', error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [user]);

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Welcome, {profileName || user?.email || 'Teacher'}</h1>
        <Button>Create Assignment</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students in Class</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assignments Created</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Submissions</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSubmissions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Graded Submissions</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gradedSubmissions}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

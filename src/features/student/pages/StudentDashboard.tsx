import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import {
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle,
  Clock,
  Phone,
  Upload,
  UserRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getStudentContext, type TeacherContact } from '@/features/student/utils/studentData';
import { TeacherInfoCard } from '@/features/student/components/TeacherInfoCard';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [teacher, setTeacher] = useState<TeacherContact | null>(null);
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [stats, setStats] = useState({
    totalAssignments: 0,
    submitted: 0,
    pending: 0,
    averageMarks: null as number | null,
    attendancePct: null as number | null,
    unreadNotifications: 0,
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
      if (profileRows?.[0]) setProfileName(profileRows[0].full_name);

      const ctx = await getStudentContext(user.id);
      if (!ctx || !ctx.batchId) {
        setNeedsSetup(true);
        setTeacher(ctx?.teacher ?? null);
        setCourseName(ctx?.courseName || '');
        setBatchName(ctx?.batchName || '');
        setLoading(false);
        return;
      }

      setNeedsSetup(false);
      setTeacher(ctx.teacher);
      setCourseName(ctx.courseName);
      setBatchName(ctx.batchName);

      const [{ data: assignments }, { data: attendance }, { count: unread }] = await Promise.all([
        supabase.from('assignments').select('id').eq('batch_id', ctx.batchId),
        supabase
          .from('attendance')
          .select('status')
          .eq('student_id', ctx.studentId),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false),
      ]);

      const assignmentIds = (assignments ?? []).map((a) => a.id);
      let submissionRows: Array<{ assignment_id: string; marks: number | null }> = [];
      if (assignmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('assignment_id, marks')
          .eq('student_id', ctx.studentId)
          .in('assignment_id', assignmentIds);
        submissionRows = submissions ?? [];
      }

      const submittedCount = submissionRows.length;
      const gradedMarks = submissionRows
        .filter((s) => s.marks != null)
        .map((s) => s.marks as number);
      const averageMarks = gradedMarks.length
        ? Math.round(gradedMarks.reduce((sum, m) => sum + m, 0) / gradedMarks.length)
        : null;

      const att = attendance ?? [];
      const present = att.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      const attendancePct =
        att.length > 0 ? Math.round((present / att.length) * 100) : null;

      setStats({
        totalAssignments: assignmentIds.length,
        submitted: submittedCount,
        pending: Math.max(assignmentIds.length - submittedCount, 0),
        averageMarks,
        attendancePct,
        unreadNotifications: unread ?? 0,
      });
      setLoading(false);
    }

    void loadDashboard();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-8 text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  const quickLinks = [
    { to: '/dashboard/my-assignments', label: 'Assignments', icon: BookOpen },
    { to: '/dashboard/my-submissions', label: 'Submissions', icon: Upload },
    { to: '/dashboard/my-grades', label: 'My Grades', icon: Award },
    { to: '/dashboard/my-attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/dashboard/my-notifications', label: 'Notifications', icon: Bell },
    { to: '/dashboard/my-profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profileName || user?.email || 'Student'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit work to your teacher, track marks, and check attendance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/my-assignments">Open Assignments</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={needsSetup ? '/dashboard/my-profile' : '/dashboard/my-grades'}>
              {needsSetup ? 'View Profile' : 'My Grades'}
            </Link>
          </Button>
        </div>
      </div>

      <TeacherInfoCard teacher={teacher} courseName={courseName} batchName={batchName} />

      {needsSetup ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-amber-950">Batch not assigned yet</p>
              <p className="mt-1 text-sm text-amber-900/80">
                Ask admin to assign your course/batch. After that, assignments and attendance will
                appear here.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0 border-amber-300 bg-white">
              <Link to="/dashboard/my-profile">View Profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {teacher && teacher.phone !== '—' ? (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-4 w-4" />
            Teacher: <strong className="text-foreground">{teacher.fullName}</strong>
          </span>
          <a
            href={`tel:${teacher.phone}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Phone className="h-4 w-4" />
            {teacher.phone}
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assignments</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Marks</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageMarks != null ? `${stats.averageMarks}/100` : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.attendancePct == null ? '—' : `${stats.attendancePct}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unreadNotifications}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <link.icon className="h-4 w-4 text-primary" />
              {link.label}
              {link.to.includes('notifications') && stats.unreadNotifications > 0 ? (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                  {stats.unreadNotifications}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { getStudentContext, type TeacherContact } from '@/features/student/utils/studentData';
import { TeacherInfoCard } from '@/features/student/components/TeacherInfoCard';

type AttendanceRow = {
  id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
};

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'present') return 'bg-emerald-100 text-emerald-800';
  if (s === 'absent') return 'bg-red-100 text-red-800';
  if (s === 'late') return 'bg-amber-100 text-amber-900';
  if (s === 'excused') return 'bg-sky-100 text-sky-800';
  return 'bg-muted text-muted-foreground';
}

export default function StudentAttendancePage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [teacher, setTeacher] = useState<TeacherContact | null>(null);
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      setError('');

      const ctx = await getStudentContext(user.id);
      setTeacher(ctx?.teacher ?? null);
      setCourseName(ctx?.courseName || '');
      setBatchName(ctx?.batchName || '');

      if (!ctx?.studentId) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('attendance')
        .select('id, attendance_date, status, notes')
        .eq('student_id', ctx.studentId)
        .order('attendance_date', { ascending: false });

      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as AttendanceRow[]) ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [user?.id]);

  const stats = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'Present').length;
    const late = rows.filter((r) => r.status === 'Late').length;
    const absent = rows.filter((r) => r.status === 'Absent').length;
    const excused = rows.filter((r) => r.status === 'Excused').length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : null;
    return { total, present, late, absent, excused, pct };
  }, [rows]);

  const absentDays = useMemo(
    () => rows.filter((r) => r.status === 'Absent'),
    [rows],
  );

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="mt-1 text-muted-foreground">
          Marked by your course teacher — percentage and day-wise history.
        </p>
      </div>

      <TeacherInfoCard
        teacher={teacher}
        courseName={courseName}
        batchName={batchName}
        compact
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Attendance %</p>
            <p className="mt-1 text-2xl font-bold">
              {stats.pct == null ? '—' : `${stats.pct}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Late</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.late}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Absent</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{stats.absent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Excused</p>
            <p className="mt-1 text-2xl font-bold">{stats.excused}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Absent days ({absentDays.length})
          </p>
          {absentDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No absent days recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {absentDays.map((d) => (
                <span
                  key={d.id}
                  className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
                >
                  {new Date(d.attendance_date).toLocaleDateString()}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">SR#</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      <CalendarCheck className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No attendance marked yet by your teacher.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.id} className="border-b">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        {new Date(r.attendance_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusClass(
                            r.status,
                          )}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

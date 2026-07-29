import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck, Save } from 'lucide-react';
import {
  getTeacherAssignedCourse,
  getTeacherBatches,
  getTeacherEntityId,
  getTeacherStudents,
  relationOne,
  resolveStudentGender,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

type Student = {
  id: string;
  batch_id?: string | null;
  application_id?: string | null;
  gender?: string | null;
  batches?: { name?: string | null } | { name?: string | null }[] | null;
  profiles?:
    | { full_name?: string | null; email?: string | null }
    | { full_name?: string | null; email?: string | null }[]
    | null;
};

type Status = 'Present' | 'Absent' | 'Late' | 'Excused';
type GenderTab = 'Female' | 'Male';

const STATUS_OPTIONS: Status[] = ['Present', 'Absent', 'Late', 'Excused'];

export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<Record<string, { present: number; total: number }>>({});
  const [genderTab, setGenderTab] = useState<GenderTab>(() => {
    const g = searchParams.get('gender');
    return g === 'Male' || g === 'Female' ? g : 'Female';
  });
  const [focusQuery, setFocusQuery] = useState(() => searchParams.get('q') || '');
  const [courseName, setCourseName] = useState<string | null>(null);
  const [genderScope, setGenderScope] = useState<GenderScope | null>(null);

  useEffect(() => {
    const g = searchParams.get('gender');
    if (g === 'Male' || g === 'Female') setGenderTab(g);
    const q = searchParams.get('q');
    if (q) setFocusQuery(q);
  }, [searchParams]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const assigned = await getTeacherAssignedCourse(user.id);
      setCourseName(assigned?.name ?? null);
      setGenderScope(assigned?.genderScope ?? null);

      const entityId = await getTeacherEntityId(user.id);
      setTeacherId(entityId);
      let list: Student[] = [];
      try {
        list = await getTeacherStudents<Student>(
          user.id,
          'id, batch_id, application_id, gender, batches(name), profiles(full_name, email)',
        );
      } catch {
        list = await getTeacherStudents<Student>(
          user.id,
          'id, batch_id, application_id, batches(name), profiles(full_name, email)',
        );
      }
      setStudents(list);

      const ids = list.map((s) => s.id);
      const { data: existing } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('attendance_date', date)
        .in('student_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

      const map: Record<string, Status> = {};
      for (const s of list) map[s.id] = 'Present';
      for (const row of existing ?? []) {
        map[row.student_id] = row.status as Status;
      }
      setMarks(map);

      if (list.length > 0) {
        const { data: allAtt } = await supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', ids);
        const agg: Record<string, { present: number; total: number }> = {};
        for (const s of list) agg[s.id] = { present: 0, total: 0 };
        for (const row of allAtt ?? []) {
          if (!agg[row.student_id]) continue;
          agg[row.student_id].total += 1;
          if (row.status === 'Present' || row.status === 'Late') {
            agg[row.student_id].present += 1;
          }
        }
        setStats(agg);
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Failed to load attendance. Run teacher_attendance_notifications.sql in Supabase.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id, date]);

  const visibleStudents = useMemo(() => {
    return students.filter((s) => {
      const g = resolveStudentGender({
        gender: s.gender,
        batchName: relationOne(s.batches)?.name,
      });
      return g === genderTab;
    });
  }, [students, genderTab]);

  const isFocusedStudent = (s: Student) => {
    const q = focusQuery.toLowerCase().trim();
    if (!q) return false;
    const p = relationOne(s.profiles);
    return (
      (s.application_id || '').toLowerCase() === q ||
      (s.application_id || '').toLowerCase().includes(q) ||
      (p?.full_name || '').toLowerCase().includes(q)
    );
  };

  const counts = useMemo(() => {
    let female = 0;
    let male = 0;
    for (const s of students) {
      const g = resolveStudentGender({
        gender: s.gender,
        batchName: relationOne(s.batches)?.name,
      });
      if (g === 'Female') female += 1;
      if (g === 'Male') male += 1;
    }
    return { Female: female, Male: male };
  }, [students]);

  const summary = useMemo(() => {
    const values = visibleStudents.map((s) => marks[s.id] || 'Present');
    return {
      present: values.filter((v) => v === 'Present').length,
      absent: values.filter((v) => v === 'Absent').length,
      late: values.filter((v) => v === 'Late').length,
      excused: values.filter((v) => v === 'Excused').length,
    };
  }, [marks, visibleStudents]);

  const markAllVisible = (status: Status) => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const s of visibleStudents) next[s.id] = status;
      return next;
    });
  };

  const saveAttendance = async () => {
    if (!visibleStudents.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const batches = await getTeacherBatches(user!.id);
      const defaultBatchId = batches[0]?.id ?? null;

      // Save only the active gender group (separate attendance sessions)
      const rows = visibleStudents.map((s) => ({
        student_id: s.id,
        teacher_id: teacherId,
        batch_id: s.batch_id || defaultBatchId,
        attendance_date: date,
        status: marks[s.id] || 'Present',
      }));

      const { error } = await supabase.from('attendance').upsert(rows, {
        onConflict: 'student_id,attendance_date',
      });
      if (error) throw error;

      setMessage({
        type: 'success',
        text: `${genderTab} attendance saved for ${date} (${rows.length} students).`,
      });
      await load();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Save failed. Run teacher_attendance_notifications.sql in Supabase SQL Editor.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope}>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Pick any date â€” today or past â€” then Save to update. Female and Male are marked separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button
            onClick={saveAttendance}
            disabled={saving || loading || !visibleStudents.length}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : `Save ${genderTab} Attendance`}
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['Female', 'Male'] as GenderTab[]).map((tab) => (
          <Button
            key={tab}
            type="button"
            variant={genderTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGenderTab(tab)}
          >
            {tab} ({counts[tab]})
          </Button>
        ))}
      </div>

      {focusQuery ? (
        <p className="text-sm text-muted-foreground">
          Opened from My Class â€” highlighting student match for{' '}
          <span className="font-medium text-foreground">{focusQuery}</span>.
          <button
            type="button"
            className="ml-2 text-primary hover:underline"
            onClick={() => setFocusQuery('')}
          >
            Clear
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => markAllVisible('Present')}>
          Mark {genderTab} Present
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => markAllVisible('Absent')}>
          Mark {genderTab} Absent
        </Button>
        <div className="text-sm text-muted-foreground self-center ml-2">
          {genderTab}: P {summary.present} Â· A {summary.absent} Â· L {summary.late} Â· E{' '}
          {summary.excused}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">SR#</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">App ID</th>
                  <th className="px-4 py-3">Status ({date})</th>
                  <th className="px-4 py-3">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : visibleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <CalendarCheck className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No {genderTab.toLowerCase()} students to mark.
                    </td>
                  </tr>
                ) : (
                  visibleStudents.map((s, index) => {
                    const p = relationOne(s.profiles);
                    const st = stats[s.id];
                    const pct =
                      st && st.total > 0 ? Math.round((st.present / st.total) * 100) : null;
                    const focused = isFocusedStudent(s);
                    return (
                      <tr
                        key={s.id}
                        className={`border-b ${focused ? 'bg-primary/10' : ''}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{p?.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{s.application_id || 'â€”'}</td>
                        <td className="px-4 py-3">
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={marks[s.id] || 'Present'}
                            onChange={(e) =>
                              setMarks((prev) => ({
                                ...prev,
                                [s.id]: e.target.value as Status,
                              }))
                            }
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {pct == null ? 'â€”' : `${pct}%`}
                          {st?.total ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({st.present}/{st.total})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </TeacherAssignmentGate>
  );
}

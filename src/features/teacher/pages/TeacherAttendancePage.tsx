import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  CalendarCheck,
  Check,
  Loader2,
  Save,
  Search,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
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

type Status = 'Present' | 'Absent';
type GenderTab = 'Female' | 'Male';

const STATUS_OPTIONS: {
  value: Status;
  label: string;
  short: string;
  active: string;
  idle: string;
}[] = [
  {
    value: 'Present',
    label: 'Present',
    short: 'P',
    active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    idle: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  },
  {
    value: 'Absent',
    label: 'Absent',
    short: 'A',
    active: 'bg-red-600 text-white border-red-600 shadow-sm',
    idle: 'border-red-200 text-red-700 hover:bg-red-50',
  },
];

/** Normalize legacy Late/Excused (and anything else) to Present/Absent only. */
function toMarkStatus(raw: string | null | undefined): Status {
  if (raw === 'Absent' || raw === 'Excused') return 'Absent';
  return 'Present';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function pctColor(pct: number) {
  if (pct >= 90) return 'text-emerald-700';
  if (pct >= 75) return 'text-sky-700';
  if (pct >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function pctBar(pct: number) {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-sky-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, { present: number; total: number }>>({});
  const [genderTab, setGenderTab] = useState<GenderTab>(() => {
    const g = searchParams.get('gender');
    return g === 'Male' || g === 'Female' ? g : 'Female';
  });
  const [focusQuery, setFocusQuery] = useState(() => searchParams.get('q') || '');
  const [search, setSearch] = useState('');
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
        map[row.student_id] = toMarkStatus(row.status);
      }
      setMarks(map);
      setSavedSnapshot({ ...map });

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
          if (toMarkStatus(row.status) === 'Present') {
            agg[row.student_id].present += 1;
          }
        }
        setStats(agg);
      }
    } catch (err: unknown) {
      toastError(err, 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, date]);

  const genderStudents = useMemo(() => {
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

  const visibleStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = genderStudents;
    if (q) {
      list = list.filter((s) => {
        const p = relationOne(s.profiles);
        return (
          (p?.full_name || '').toLowerCase().includes(q) ||
          (p?.email || '').toLowerCase().includes(q) ||
          (s.application_id || '').toLowerCase().includes(q)
        );
      });
    }
    if (focusQuery) {
      list = [...list].sort((a, b) => Number(isFocusedStudent(b)) - Number(isFocusedStudent(a)));
    }
    return list;
  }, [genderStudents, search, focusQuery]);

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
    const values = genderStudents.map((s) => marks[s.id] || 'Present');
    return {
      present: values.filter((v) => v === 'Present').length,
      absent: values.filter((v) => v === 'Absent').length,
      total: values.length,
    };
  }, [marks, genderStudents]);

  const isDirty = useMemo(() => {
    for (const s of genderStudents) {
      const cur = marks[s.id] || 'Present';
      const saved = savedSnapshot[s.id] || 'Present';
      if (cur !== saved) return true;
    }
    return false;
  }, [marks, savedSnapshot, genderStudents]);

  const markAllVisible = (status: Status) => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const s of genderStudents) next[s.id] = status;
      return next;
    });
  };

  const setOne = (id: string, status: Status) => {
    setMarks((prev) => ({ ...prev, [id]: status }));
  };

  const saveAttendance = async () => {
    if (!genderStudents.length) return;
    setSaving(true);
    try {
      const batches = await getTeacherBatches(user!.id);
      const defaultBatchId = batches[0]?.id ?? null;

      const rows = genderStudents.map((s) => ({
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

      toastSuccess(`${genderTab} attendance saved for ${formatDisplayDate(date)}.`);
      await load();
    } catch (err: unknown) {
      toastError(err, 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const isToday = date === todayISO();
  const presentRate =
    summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope} loading={loading}>
      <div className="space-y-5 pb-24">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance</h1>
              {isToday ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Today
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  Past date
                </span>
              )}
              {isDirty ? (
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                  Unsaved changes
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {courseName
                ? `${courseName}${genderScope ? ` · ${genderScope}` : ''}`
                : 'Mark Present or Absent by class'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="h-8 w-auto border-0 p-0 shadow-none focus-visible:ring-0"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayISO()}
              />
            </div>
            {!isToday ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setDate(todayISO())}>
                Jump to today
              </Button>
            ) : null}
            <Button
              onClick={saveAttendance}
              disabled={saving || loading || !genderStudents.length}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : `Save ${genderTab}`}
            </Button>
          </div>
        </div>

        {/* Date + gender context */}
        <p className="text-sm text-muted-foreground">
          Marking <span className="font-medium text-foreground">{genderTab}</span> class for{' '}
          <span className="font-medium text-foreground">{formatDisplayDate(date)}</span>
          {' · '}Female and Male are saved separately.
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="border shadow-sm">
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Roster</p>
                <p className="text-lg font-bold leading-none">{summary.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-emerald-100 bg-emerald-50/40 shadow-sm">
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                <UserCheck className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-emerald-700/80">Present</p>
                <p className="text-lg font-bold leading-none text-emerald-800">{summary.present}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-red-100 bg-red-50/40 shadow-sm">
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <UserX className="h-4 w-4 text-red-700" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-red-700/80">Absent</p>
                <p className="text-lg font-bold leading-none text-red-800">{summary.absent}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Present rate
              </p>
              <p className={`mt-1 text-lg font-bold leading-none ${pctColor(presentRate)}`}>
                {summary.total ? `${presentRate}%` : '—'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${pctBar(presentRate)}`}
                  style={{ width: `${summary.total ? presentRate : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card className="border shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(['Female', 'Male'] as GenderTab[]).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    variant={genderTab === tab ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setGenderTab(tab)}
                  >
                    {tab} ({counts[tab]})
                  </Button>
                ))}
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, email, App ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick mark
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => markAllVisible('Present')}
                disabled={!genderStudents.length}
              >
                <Check className="h-3.5 w-3.5" />
                All Present
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => markAllVisible('Absent')}
                disabled={!genderStudents.length}
              >
                <X className="h-3.5 w-3.5" />
                All Absent
              </Button>
            </div>

            {focusQuery ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Highlighting from My Class:{' '}
                  <span className="font-medium text-foreground">{focusQuery}</span>
                </span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setFocusQuery('')}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Roster table */}
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] border-b bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">SR#</th>
                    <th className="min-w-[12rem] px-4 py-3 font-semibold">Student</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">App ID</th>
                    <th className="min-w-[16rem] px-4 py-3 font-semibold">
                      Status · {date}
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Overall</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
                        Loading roster…
                      </td>
                    </tr>
                  ) : visibleStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                        <CalendarCheck className="mx-auto mb-3 h-10 w-10 opacity-30" />
                        <p className="font-medium text-foreground">
                          No {genderTab.toLowerCase()} students
                          {search ? ' match this search' : ' to mark'}
                        </p>
                        <p className="mt-1 text-sm">
                          Switch gender tab or clear search to see the roster.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleStudents.map((s, index) => {
                      const p = relationOne(s.profiles);
                      const st = stats[s.id];
                      const pct =
                        st && st.total > 0 ? Math.round((st.present / st.total) * 100) : null;
                      const focused = isFocusedStudent(s);
                      const status = marks[s.id] || 'Present';
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            focused ? 'bg-primary/10' : 'hover:bg-muted/40'
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{p?.full_name || 'Unknown'}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p?.email || '—'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                            {s.application_id || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {STATUS_OPTIONS.map((opt) => {
                                const active = status === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    title={opt.label}
                                    onClick={() => setOne(s.id, opt.value)}
                                    className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors ${
                                      active ? opt.active : opt.idle
                                    }`}
                                  >
                                    <span className="sm:hidden">{opt.short}</span>
                                    <span className="hidden sm:inline">{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {pct == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="min-w-[5.5rem]">
                                <div className="flex items-baseline gap-1">
                                  <span className={`font-semibold ${pctColor(pct)}`}>{pct}%</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    ({st.present}/{st.total})
                                  </span>
                                </div>
                                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full ${pctBar(pct)}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
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

        {/* Sticky save bar */}
        {genderStudents.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{genderTab}</span>
                {' · '}
                <span className="text-emerald-700">Present {summary.present}</span>
                {' · '}
                <span className="text-red-700">Absent {summary.absent}</span>
                {isDirty ? (
                  <span className="ml-2 text-orange-600">· Unsaved</span>
                ) : (
                  <span className="ml-2 text-emerald-600">· Saved</span>
                )}
              </div>
              <Button
                onClick={saveAttendance}
                disabled={saving || loading || !isDirty}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : `Save ${genderTab} Attendance`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </TeacherAssignmentGate>
  );
}

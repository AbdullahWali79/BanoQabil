import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Bell,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mail,
  Phone,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  cleanBatchDisplayName,
  getTeacherAssignedCourse,
  getTeacherStudents,
  relationOne,
  resolveStudentGender,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

const PAGE_SIZE = 50;

interface Student {
  id: string;
  application_id: string | null;
  father_name?: string | null;
  gender?: string | null;
  enrollment_date?: string | null;
  batch_id?: string | null;
  course_id?: string | null;
  batches?: { id: string; name?: string | null } | { id: string; name?: string | null }[] | null;
  courses?: { id: string; name?: string | null } | { id: string; name?: string | null }[] | null;
  profiles?:
    | {
        id?: string;
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
        status?: string | null;
        address?: string | null;
      }
    | {
        id?: string;
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
        status?: string | null;
        address?: string | null;
      }[]
    | null;
}

type GenderTab = 'Female' | 'Male' | 'All';

type EnrichedStudent = Student & {
  batchLabel: string;
  courseLabel: string;
  profile: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    address?: string | null;
  } | null;
  resolvedGender: 'Male' | 'Female' | 'Unknown';
};

function statusClass(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (s === 'pending') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  if (s === 'suspended') return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  return 'bg-muted text-muted-foreground ring-1 ring-border';
}

function initials(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-0.5 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium leading-snug text-foreground break-words">{children}</div>
    </div>
  );
}

export default function MyClassPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [genderTab, setGenderTab] = useState<GenderTab>('Female');
  const [courseFilter, setCourseFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [genderScope, setGenderScope] = useState<GenderScope | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchClass() {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage('');
      try {
        const assigned = await getTeacherAssignedCourse(user.id);
        setCourseName(assigned?.name ?? null);
        setGenderScope(assigned?.genderScope ?? null);

        const data = await getTeacherStudents<Student>(
          user.id,
          `id, application_id, father_name, gender, enrollment_date, batch_id, course_id,
           profiles ( id, full_name, email, phone, status, address ),
           batches ( id, name ),
           courses ( id, name )`,
        );
        setStudents(data);
      } catch {
        try {
          const data = await getTeacherStudents<Student>(
            user.id,
            'id, application_id, father_name, gender, enrollment_date, batch_id, course_id, profiles ( id, full_name, email, phone, status, address ), batches ( id, name ), courses ( id, name )',
          );
          setStudents(data);
        } catch (err2: unknown) {
          const message = err2 instanceof Error ? err2.message : 'Failed to load class';
          setErrorMessage(message);
          setStudents([]);
        }
      } finally {
        setLoading(false);
      }
    }
    void fetchClass();
  }, [user?.id]);

  const enriched = useMemo<EnrichedStudent[]>(
    () =>
      students.map((s) => {
        const batch = relationOne(s.batches);
        const course = relationOne(s.courses);
        const profile = relationOne(s.profiles);
        return {
          ...s,
          batchLabel: cleanBatchDisplayName(batch?.name),
          courseLabel: course?.name || '—',
          profile,
          resolvedGender: resolveStudentGender({
            gender: s.gender,
            batchName: batch?.name,
          }),
        };
      }),
    [students],
  );

  const courseOptions = useMemo(() => {
    const set = new Set(enriched.map((s) => s.courseLabel).filter((n) => n && n !== '—'));
    return ['All', ...[...set].sort()];
  }, [enriched]);

  const batchOptions = useMemo(() => {
    const set = new Set(enriched.map((s) => s.batchLabel).filter((n) => n && n !== '—'));
    return ['All', ...[...set].sort()];
  }, [enriched]);

  const counts = useMemo(
    () => ({
      Female: enriched.filter((s) => s.resolvedGender === 'Female').length,
      Male: enriched.filter((s) => s.resolvedGender === 'Male').length,
      Unknown: enriched.filter((s) => s.resolvedGender === 'Unknown').length,
    }),
    [enriched],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return enriched.filter((s) => {
      if (genderTab !== 'All' && s.resolvedGender !== genderTab) return false;
      if (courseFilter !== 'All' && s.courseLabel !== courseFilter) return false;
      if (batchFilter !== 'All' && s.batchLabel !== batchFilter) return false;
      if (statusFilter !== 'All' && (s.profile?.status || '') !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.profile?.full_name || '').toLowerCase().includes(q) ||
        (s.profile?.email || '').toLowerCase().includes(q) ||
        (s.application_id || '').toLowerCase().includes(q) ||
        (s.profile?.phone || '').toLowerCase().includes(q)
      );
    });
  }, [enriched, genderTab, courseFilter, batchFilter, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [genderTab, courseFilter, batchFilter, statusFilter, searchTerm]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filtered.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = enriched.find((s) => s.id === selectedId) || null;

  const copyAppId = async () => {
    const value = selected?.application_id;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const openProgress = () => {
    if (!selected) return;
    const q = selected.application_id || selected.profile?.full_name || selected.id;
    navigate(`/dashboard/progress?q=${encodeURIComponent(q)}`);
  };

  const openAttendance = () => {
    if (!selected) return;
    const params = new URLSearchParams();
    if (selected.resolvedGender === 'Male' || selected.resolvedGender === 'Female') {
      params.set('gender', selected.resolvedGender);
    }
    if (selected.application_id) params.set('q', selected.application_id);
    navigate(`/dashboard/attendance?${params.toString()}`);
  };

  const openNotification = () => {
    if (!selected?.profile?.id) return;
    const params = new URLSearchParams({
      student: selected.profile.id,
      mode: 'selected',
    });
    if (selected.application_id) params.set('q', selected.application_id);
    navigate(`/dashboard/notifications?${params.toString()}`);
  };

  const selectClassName =
    'h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope} loading={loading}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Classes</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {courseName
                ? `${courseName}${genderScope ? ` · ${genderScope}` : ''}`
                : 'Full student records for your class'}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              Showing{' '}
              <span className="font-semibold text-foreground">{filtered.length}</span> student
              {filtered.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {/* Filters */}
        <Card className="border shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {(['Female', 'Male', 'All'] as GenderTab[]).map((tab) => (
                <Button
                  key={tab}
                  type="button"
                  variant={genderTab === tab ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setGenderTab(tab);
                    setSelectedId(null);
                  }}
                >
                  {tab}
                  {tab !== 'All' ? ` (${counts[tab]})` : ` (${students.length})`}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative sm:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, email, phone, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className={selectClassName}
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                {courseOptions.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Courses' : c}
                  </option>
                ))}
              </select>
              <select
                className={selectClassName}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                {batchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b === 'All' ? 'All Batches' : b}
                  </option>
                ))}
              </select>
              <select
                className={selectClassName}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Table + detail */}
        <div
          className={`grid gap-5 ${
            selected
              ? 'xl:grid-cols-[minmax(0,1fr)_320px]'
              : 'grid-cols-1'
          }`}
        >
          <Card className="min-w-0 overflow-hidden border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-[1] border-b bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">SR#</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">App ID</th>
                      <th className="min-w-[10rem] px-4 py-3 font-semibold">Name</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Phone</th>
                      <th className="min-w-[8rem] px-4 py-3 font-semibold">Course</th>
                      <th className="min-w-[8rem] px-4 py-3 font-semibold">Batch</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                          <Users className="mx-auto mb-3 h-10 w-10 opacity-30" />
                          <p className="font-medium text-foreground">No students found</p>
                          <p className="mt-1 text-sm">Try another gender tab or clear filters.</p>
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((s, index) => {
                        const sr = (currentPage - 1) * PAGE_SIZE + index + 1;
                        const active = selectedId === s.id;
                        return (
                          <tr
                            key={s.id}
                            className={`cursor-pointer transition-colors ${
                              active
                                ? 'bg-primary/10 ring-1 ring-inset ring-primary/20'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedId(s.id)}
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {sr}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                              {s.application_id || '—'}
                            </td>
                            <td
                              className="max-w-[14rem] truncate px-4 py-3 font-medium"
                              title={s.profile?.full_name || undefined}
                            >
                              {s.profile?.full_name || '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                              {s.profile?.phone || '—'}
                            </td>
                            <td
                              className="max-w-[11rem] truncate px-4 py-3 text-xs text-muted-foreground"
                              title={s.courseLabel}
                            >
                              {s.courseLabel}
                            </td>
                            <td
                              className="max-w-[12rem] truncate px-4 py-3 text-xs text-muted-foreground"
                              title={s.batchLabel}
                            >
                              {s.batchLabel}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(
                                  s.profile?.status,
                                )}`}
                              >
                                {s.profile?.status || '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filtered.length > PAGE_SIZE ? (
                <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </Button>
                    <span className="min-w-[4.5rem] text-center text-sm font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Detail panel — viewport height, sticky actions (no full-page scroll) */}
          {selected ? (
            <>
              {/* Mobile backdrop */}
              <button
                type="button"
                aria-label="Close student record"
                className="fixed inset-0 z-40 bg-black/40 xl:hidden"
                onClick={() => setSelectedId(null)}
              />

              <Card
                className="fixed inset-x-3 bottom-3 top-auto z-50 flex max-h-[min(85vh,640px)] flex-col border shadow-lg xl:sticky xl:inset-x-auto xl:bottom-auto xl:top-20 xl:z-auto xl:max-h-[calc(100vh-6rem)] xl:self-start xl:shadow-sm"
              >
                <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
                  {/* Header */}
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(selected.profile?.full_name)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">
                          {selected.profile?.full_name || 'Student Record'}
                        </h2>
                        <p className="text-[11px] text-muted-foreground">Student Record</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Close"
                      onClick={() => setSelectedId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Scrollable fields only */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      <Field label="App ID">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{selected.application_id || '—'}</span>
                          {selected.application_id ? (
                            <button
                              type="button"
                              onClick={copyAppId}
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Copy App ID"
                            >
                              <Copy size={13} />
                            </button>
                          ) : null}
                        </div>
                        {copied ? (
                          <p className="text-[10px] font-normal text-emerald-600">Copied</p>
                        ) : null}
                      </Field>
                      <Field label="Gender">{selected.resolvedGender}</Field>
                      <Field label="Status">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(
                            selected.profile?.status,
                          )}`}
                        >
                          {selected.profile?.status || '—'}
                        </span>
                      </Field>
                      <Field label="Father Name">{selected.father_name || '—'}</Field>
                      <Field label="Email" className="col-span-2">
                        {selected.profile?.email ? (
                          <a
                            href={`mailto:${selected.profile.email}`}
                            className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
                          >
                            <Mail size={13} className="shrink-0" />
                            <span className="truncate">{selected.profile.email}</span>
                          </a>
                        ) : (
                          '—'
                        )}
                      </Field>
                      <Field label="Phone">
                        {selected.profile?.phone ? (
                          <a
                            href={`tel:${selected.profile.phone}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Phone size={13} className="shrink-0" />
                            {selected.profile.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </Field>
                      <Field label="Enrollment">{selected.enrollment_date || '—'}</Field>
                      <Field label="Course">{selected.courseLabel}</Field>
                      <Field label="Batch">{selected.batchLabel}</Field>
                      <Field label="Address" className="col-span-2">
                        <span className="font-normal text-muted-foreground">
                          {selected.profile?.address || '—'}
                        </span>
                      </Field>
                    </div>
                  </div>

                  {/* Actions always visible */}
                  <div className="shrink-0 grid gap-1.5 border-t bg-background px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start gap-2"
                      onClick={openProgress}
                    >
                      <BarChart3 size={14} />
                      View Progress
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start gap-2"
                      onClick={openAttendance}
                    >
                      <CalendarCheck size={14} />
                      Mark Attendance
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start gap-2"
                      onClick={openNotification}
                      disabled={!selected.profile?.id}
                    >
                      <Bell size={14} />
                      Send Notification
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="hidden border border-dashed shadow-none xl:block xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-6rem)]">
              <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No student selected</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click a row to view the student record.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TeacherAssignmentGate>
  );
}

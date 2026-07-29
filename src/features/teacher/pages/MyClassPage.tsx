import { useEffect, useMemo, useState } from 'react';
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
  if (s === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (s === 'pending') return 'bg-amber-100 text-amber-800';
  if (s === 'suspended') return 'bg-red-100 text-red-800';
  return 'bg-muted text-muted-foreground';
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
          courseLabel: course?.name || 'â€”',
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
    const set = new Set(enriched.map((s) => s.courseLabel).filter((n) => n && n !== 'â€”'));
    return ['All', ...[...set].sort()];
  }, [enriched]);

  const batchOptions = useMemo(() => {
    const set = new Set(enriched.map((s) => s.batchLabel).filter((n) => n && n !== 'â€”'));
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
      mode: 'single',
    });
    if (selected.application_id) params.set('q', selected.application_id);
    navigate(`/dashboard/notifications?${params.toString()}`);
  };

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="mt-1 text-muted-foreground">
              {courseName
                ? `${courseName}${genderScope ? ` Â· ${genderScope}` : ''}`
                : 'Full student records for your class'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> student
            {filtered.length === 1 ? '' : 's'}
            {filtered.length > PAGE_SIZE ? ` Â· page ${currentPage}/${totalPages}` : ''}
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(['Female', 'Male', 'All'] as GenderTab[]).map((tab) => (
            <Button
              key={tab}
              type="button"
              variant={genderTab === tab ? 'default' : 'outline'}
              size="sm"
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email, phone, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
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
            className="h-10 rounded-md border bg-background px-3 text-sm"
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
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">SR#</th>
                      <th className="px-3 py-3">App ID</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Course</th>
                      <th className="px-3 py-3">Batch</th>
                      <th className="px-3 py-3">Gender</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                          Loading class rosterâ€¦
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
                          No students match these filters.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((s, index) => {
                        const sr = (currentPage - 1) * PAGE_SIZE + index + 1;
                        return (
                          <tr
                            key={s.id}
                            className={`cursor-pointer border-b transition-colors ${
                              selectedId === s.id ? 'bg-primary/10' : 'hover:bg-muted/40'
                            }`}
                            onClick={() => setSelectedId(s.id)}
                          >
                            <td className="px-3 py-3 text-muted-foreground">{sr}</td>
                            <td className="px-3 py-3 font-mono text-xs">
                              {s.application_id || 'â€”'}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {s.profile?.full_name || 'â€”'}
                            </td>
                            <td className="px-3 py-3">{s.profile?.phone || 'â€”'}</td>
                            <td className="px-3 py-3 text-xs">{s.courseLabel}</td>
                            <td className="px-3 py-3 text-xs">{s.batchLabel}</td>
                            <td className="px-3 py-3 text-xs">{s.resolvedGender}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusClass(
                                  s.profile?.status,
                                )}`}
                              >
                                {s.profile?.status || 'â€”'}
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
                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {(currentPage - 1) * PAGE_SIZE + 1}â€“
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

          <Card className="xl:sticky xl:top-20 xl:self-start">
            <CardContent className="space-y-4 p-5">
              <h2 className="text-lg font-semibold">Student Record</h2>
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Click any student row to view full details and actions.
                </p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="text-base font-semibold">
                      {selected.profile?.full_name || 'â€”'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground">App ID</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="font-mono text-xs">{selected.application_id || 'â€”'}</p>
                        {selected.application_id ? (
                          <button
                            type="button"
                            onClick={copyAppId}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Copy App ID"
                          >
                            <Copy size={14} />
                          </button>
                        ) : null}
                      </div>
                      {copied ? (
                        <p className="mt-1 text-[11px] text-emerald-600">Copied</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-medium">{selected.resolvedGender}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      {selected.profile?.email ? (
                        <a
                          href={`mailto:${selected.profile.email}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Mail size={13} />
                          {selected.profile.email}
                        </a>
                      ) : (
                        <p>â€”</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      {selected.profile?.phone ? (
                        <a
                          href={`tel:${selected.profile.phone}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Phone size={13} />
                          {selected.profile.phone}
                        </a>
                      ) : (
                        <p>â€”</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Father Name</p>
                      <p>{selected.father_name || 'â€”'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <span
                        className={`mt-0.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusClass(
                          selected.profile?.status,
                        )}`}
                      >
                        {selected.profile?.status || 'â€”'}
                      </span>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Course</p>
                      <p className="font-medium">{selected.courseLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Batch</p>
                      <p>{selected.batchLabel}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Enrollment</p>
                      <p>{selected.enrollment_date || 'â€”'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p>{selected.profile?.address || 'â€”'}</p>
                  </div>

                  <div className="grid gap-2 border-t pt-3">
                    <Button type="button" size="sm" variant="outline" onClick={openProgress}>
                      <BarChart3 size={15} />
                      View Progress
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={openAttendance}>
                      <CalendarCheck size={15} />
                      Mark Attendance
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openNotification}
                      disabled={!selected.profile?.id}
                    >
                      <Bell size={15} />
                      Send Notification
                    </Button>
                    {!selected.profile?.id ? (
                      <p className="text-xs text-muted-foreground">
                        Notification unavailable â€” student profile id missing.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherAssignmentGate>
  );
}

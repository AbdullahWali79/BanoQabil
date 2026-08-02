import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole, SUPER_ADMIN_EMAIL } from '@/lib/roles';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AccessDenied } from '@/components/layout/AccessDenied';
import {
  Banknote,
  Clock,
  FileDown,
  LayoutDashboard,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  createReportDoc,
  currentMonthValue,
  defaultTableStyles,
  lastTableY,
  moneyPKR,
  monthLabel,
  paintFooters,
  paintReportHeader,
  paintSectionTitle,
  paintSummaryBar,
  parseMonthValue,
} from '@/lib/reportPdf';
import { downloadSystemReportPdf } from '@/lib/systemReportPdf';

type StaffKind = 'Teacher' | 'Admin' | 'Other';
type ExportMode = 'system' | 'all' | 'person';

type PayPerson = {
  key: string;
  kind: StaffKind;
  name: string;
  phone: string | null;
  email: string | null;
  jobTitle: string;
  profileId: string | null;
  staffMemberId: string | null;
  defaultSalary: number | null;
  isActive: boolean;
  notes: string | null;
};

type PayRow = {
  id: string;
  profile_id: string | null;
  staff_member_id: string | null;
  year: number;
  month: number;
  amount: number;
  status: 'Pending' | 'Paid';
  paid_at: string | null;
  notes: string | null;
};

export default function SuperAdminReportsPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const isSuperAdmin = appRole === 'Super Admin';

  const [people, setPeople] = useState<PayPerson[]>([]);
  const [allPayHistory, setAllPayHistory] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('system');
  const [exportMonth, setExportMonth] = useState(currentMonthValue());
  const [exportPersonKey, setExportPersonKey] = useState('');
  const [kindFilter, setKindFilter] = useState<'All' | StaffKind>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending'>('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: profiles, error: profileError },
        { data: otherStaff, error: staffError },
        { data: pays, error: payError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, status, roles!inner(name)')
          .in('roles.name', ['Teacher', 'Admin'])
          .order('full_name'),
        supabase
          .from('staff_members')
          .select('id, full_name, phone, job_title, monthly_salary, is_active, notes')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('staff_monthly_pay')
          .select('id, profile_id, staff_member_id, year, month, amount, status, paid_at, notes')
          .order('year', { ascending: false }),
      ]);

      if (profileError) throw new Error(profileError.message);
      if (staffError) throw new Error(staffError.message);
      if (payError) throw new Error(payError.message);

      const fromProfiles: PayPerson[] = ((profiles ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const roleRel = relationOne(row.roles as { name?: string } | { name?: string }[] | null);
          const roleName = roleRel?.name || '';
          const email = String(row.email || '').toLowerCase();
          if (email === SUPER_ADMIN_EMAIL) return null;
          if (roleName !== 'Teacher' && roleName !== 'Admin') return null;
          return {
            key: `profile:${row.id}`,
            kind: (roleName === 'Admin' ? 'Admin' : 'Teacher') as StaffKind,
            name: String(row.full_name || email || 'Unnamed'),
            phone: (row.phone as string | null) ?? null,
            email: (row.email as string | null) ?? null,
            jobTitle: roleName === 'Admin' ? 'Admin' : 'Teacher',
            profileId: String(row.id),
            staffMemberId: null,
            defaultSalary: null,
            isActive: row.status === 'Approved',
            notes: null,
          };
        })
        .filter(Boolean) as PayPerson[];

      const fromOther: PayPerson[] = ((otherStaff ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          key: `staff:${row.id}`,
          kind: 'Other' as const,
          name: String(row.full_name || 'Unnamed'),
          phone: (row.phone as string | null) ?? null,
          email: null,
          jobTitle: String(row.job_title || 'Staff'),
          profileId: null,
          staffMemberId: String(row.id),
          defaultSalary:
            row.monthly_salary == null || row.monthly_salary === ''
              ? null
              : Number(row.monthly_salary),
          isActive: Boolean(row.is_active),
          notes: (row.notes as string | null) ?? null,
        }),
      );

      setPeople([...fromProfiles, ...fromOther]);
      setAllPayHistory(
        ((pays ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          profile_id: (row.profile_id as string | null) ?? null,
          staff_member_id: (row.staff_member_id as string | null) ?? null,
          year: Number(row.year),
          month: Number(row.month),
          amount: Number(row.amount ?? 0),
          status: (row.status as 'Pending' | 'Paid') || 'Pending',
          paid_at: (row.paid_at as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
        })),
      );
    } catch (err: unknown) {
      setPeople([]);
      setAllPayHistory([]);
      toastError(err, 'Failed to load staff data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadData();
  }, [isSuperAdmin, loadData]);

  const { year: previewYear, month: previewMonth } = parseMonthValue(exportMonth);

  const monthRows = useMemo(() => {
    return people.map((person) => {
      const pay = allPayHistory.find(
        (row) =>
          row.year === previewYear &&
          row.month === previewMonth &&
          (person.profileId
            ? row.profile_id === person.profileId
            : row.staff_member_id === person.staffMemberId),
      );
      const amount = pay?.amount ?? person.defaultSalary ?? 0;
      const status = pay?.status ?? 'Pending';
      return { person, pay, amount, status };
    });
  }, [people, allPayHistory, previewYear, previewMonth]);

  const previewStats = useMemo(() => {
    const filtered = monthRows.filter((r) => {
      if (kindFilter !== 'All' && r.person.kind !== kindFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      return true;
    });
    const paid = filtered.filter((r) => r.status === 'Paid');
    const pending = filtered.filter((r) => r.status === 'Pending');
    const byKind = {
      Teacher: filtered.filter((r) => r.person.kind === 'Teacher').length,
      Admin: filtered.filter((r) => r.person.kind === 'Admin').length,
      Other: filtered.filter((r) => r.person.kind === 'Other').length,
    };
    return {
      total: filtered.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      paidAmount: paid.reduce((s, r) => s + r.amount, 0),
      pendingAmount: pending.reduce((s, r) => s + r.amount, 0),
      byKind,
      rows: filtered,
    };
  }, [monthRows, kindFilter, statusFilter]);

  const historyFor = useCallback(
    (person: PayPerson) =>
      allPayHistory
        .filter((row) =>
          person.profileId
            ? row.profile_id === person.profileId
            : row.staff_member_id === person.staffMemberId,
        )
        .sort((a, b) => b.year - a.year || b.month - a.month),
    [allPayHistory],
  );

  const exportAllStaffReport = async () => {
    const { year, month } = parseMonthValue(exportMonth);
    const label = monthLabel(year, month);
    const rows = previewStats.rows;

    const { doc, autoTable } = await createReportDoc('landscape');
    paintReportHeader(doc, {
      title: 'Staff Pay Report',
      subtitle: 'All staff · paid, pending & breakdown',
      metaLeft: label,
      metaRight: new Date().toLocaleString(),
      theme: 'indigo',
    });

    let y = paintSummaryBar(
      doc,
      34,
      [
        `Staff ${previewStats.total}`,
        `Teachers ${previewStats.byKind.Teacher}`,
        `Admins ${previewStats.byKind.Admin}`,
        `Other ${previewStats.byKind.Other}`,
        `Paid ${moneyPKR(previewStats.paidAmount)}`,
        `Pending ${moneyPKR(previewStats.pendingAmount)}`,
      ],
      'indigo',
    );

    y = paintSectionTitle(doc, y, `${label} — payroll sheet`);
    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          '#',
          'Name',
          'Role',
          'Job',
          'Phone',
          'Email',
          'Default salary',
          'This month',
          'Status',
          'Paid at',
          'Notes',
        ],
      ],
      body: rows.map((r, i) => [
        String(i + 1),
        r.person.name,
        r.person.kind,
        r.person.jobTitle,
        r.person.phone || '—',
        r.person.email || '—',
        r.person.defaultSalary == null ? '—' : moneyPKR(r.person.defaultSalary),
        moneyPKR(r.amount),
        r.status,
        r.pay?.paid_at ? new Date(r.pay.paid_at).toLocaleDateString() : '—',
        r.pay?.notes || '—',
      ]),
      ...defaultTableStyles('indigo'),
      styles: { ...defaultTableStyles('indigo').styles, fontSize: 7 },
    });

    y = lastTableY(doc) + 10;
    y = paintSectionTitle(doc, y, 'Pay summary by role');
    const kinds: StaffKind[] = ['Teacher', 'Admin', 'Other'];
    autoTable(doc, {
      startY: y + 2,
      head: [['Role', 'People', 'Paid count', 'Pending count', 'Paid amount', 'Pending amount']],
      body: kinds.map((k) => {
        const subset = rows.filter((r) => r.person.kind === k);
        const paid = subset.filter((r) => r.status === 'Paid');
        const pending = subset.filter((r) => r.status === 'Pending');
        return [
          k,
          String(subset.length),
          String(paid.length),
          String(pending.length),
          moneyPKR(paid.reduce((s, r) => s + r.amount, 0)),
          moneyPKR(pending.reduce((s, r) => s + r.amount, 0)),
        ];
      }),
      ...defaultTableStyles('slate'),
    });

    paintFooters(doc, 'BanoQabil LMS · Super Admin · Staff Pay');
    doc.save(`banoqabil-staff-pay-${exportMonth}.pdf`);
  };

  const exportPersonReport = async (person: PayPerson) => {
    const { year, month } = parseMonthValue(exportMonth);
    const focusLabel = monthLabel(year, month);
    const history = historyFor(person);
    const focusPay = history.find((h) => h.year === year && h.month === month);
    const focusAmount = focusPay?.amount ?? person.defaultSalary ?? 0;
    const focusStatus = focusPay?.status ?? 'Pending';

    const paidHistory = history.filter((h) => h.status === 'Paid');
    const pendingHistory = history.filter((h) => h.status === 'Pending');
    const lifetimePaid = paidHistory.reduce((s, h) => s + h.amount, 0);
    const lifetimePending = pendingHistory.reduce((s, h) => s + h.amount, 0);

    let teacherExtra: {
      course: string;
      scope: string;
      students: number;
      assignments: number;
      graded: number;
      pendingGrades: number;
      submissions: number;
      attDays: number;
      present: number;
      absent: number;
    } | null = null;

    if (person.kind === 'Teacher' && person.profileId) {
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('id, profile_id, teacher_courses(gender_scope, courses(name))')
        .eq('profile_id', person.profileId)
        .maybeSingle();

      if (teacherRow) {
        const teacherId = String(teacherRow.id);
        const tc = relationOne(teacherRow.teacher_courses as never) as {
          gender_scope?: string | null;
          courses?: { name?: string } | { name?: string }[] | null;
        } | null;
        const course = relationOne(tc?.courses as never) as { name?: string } | null;

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const startDate = startIso.slice(0, 10);
        const endDate = end.toISOString().slice(0, 10);

        const [{ data: batches }, { data: assignments }, { data: attendance }] = await Promise.all([
          supabase.from('batches').select('id').eq('teacher_id', teacherId),
          supabase
            .from('assignments')
            .select('id')
            .in('teacher_id', [teacherId, person.profileId])
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          supabase
            .from('attendance')
            .select('attendance_date, status')
            .eq('teacher_id', teacherId)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate),
        ]);

        const batchIds = (batches ?? []).map((b) => b.id);
        let students = 0;
        if (batchIds.length > 0) {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('batch_id', batchIds);
          students = count ?? 0;
        }

        const assignmentIds = (assignments ?? []).map((a) => a.id);
        let graded = 0;
        let pendingGrades = 0;
        let submissions = 0;
        if (assignmentIds.length > 0) {
          const { data: subs } = await supabase
            .from('submissions')
            .select('marks')
            .in('assignment_id', assignmentIds);
          submissions = (subs ?? []).length;
          graded = (subs ?? []).filter((s) => s.marks != null).length;
          pendingGrades = (subs ?? []).filter((s) => s.marks == null).length;
        }

        teacherExtra = {
          course: course?.name || '—',
          scope: tc?.gender_scope || 'Not set',
          students,
          assignments: assignmentIds.length,
          graded,
          pendingGrades,
          submissions,
          attDays: new Set((attendance ?? []).map((a) => String(a.attendance_date))).size,
          present: (attendance ?? []).filter(
            (a) => a.status === 'Present' || a.status === 'Late',
          ).length,
          absent: (attendance ?? []).filter((a) => a.status === 'Absent').length,
        };
      }
    }

    const { doc, autoTable } = await createReportDoc('portrait');
    paintReportHeader(doc, {
      title: 'Staff Person Report',
      subtitle: 'Profile · focus month · full pay history',
      metaLeft: focusLabel,
      metaRight: new Date().toLocaleString(),
      theme: 'slate',
    });

    let y = paintSummaryBar(
      doc,
      34,
      [
        person.name,
        `${person.kind} · ${person.jobTitle}`,
        `${focusStatus} ${moneyPKR(focusAmount)}`,
        `Lifetime paid ${moneyPKR(lifetimePaid)}`,
      ],
      'slate',
    );

    y = paintSectionTitle(doc, y, 'Personal details');
    autoTable(doc, {
      startY: y + 2,
      head: [['Field', 'Value']],
      body: [
        ['Full name', person.name],
        ['Role', person.kind],
        ['Job title', person.jobTitle],
        ['Email', person.email || '—'],
        ['Phone', person.phone || '—'],
        ['Account status', person.isActive ? 'Active / Approved' : 'Inactive'],
        [
          'Default monthly salary',
          person.defaultSalary == null ? '—' : moneyPKR(person.defaultSalary),
        ],
        ['Notes', person.notes || '—'],
      ],
      ...defaultTableStyles('slate'),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    });

    y = lastTableY(doc) + 10;
    y = paintSectionTitle(doc, y, `${focusLabel} — pay detail`);
    autoTable(doc, {
      startY: y + 2,
      head: [['Amount', 'Status', 'Paid at', 'Notes']],
      body: [
        [
          moneyPKR(focusAmount),
          focusStatus,
          focusPay?.paid_at ? new Date(focusPay.paid_at).toLocaleString() : '—',
          focusPay?.notes || '—',
        ],
      ],
      ...defaultTableStyles(focusStatus === 'Paid' ? 'emerald' : 'indigo'),
    });

    if (teacherExtra) {
      y = lastTableY(doc) + 10;
      y = paintSectionTitle(doc, y, `${focusLabel} — teaching activity`);
      autoTable(doc, {
        startY: y + 2,
        head: [['Metric', 'Value', 'Metric', 'Value']],
        body: [
          ['Course', teacherExtra.course, 'Scope', teacherExtra.scope],
          ['Students', String(teacherExtra.students), 'Assignments', String(teacherExtra.assignments)],
          ['Submissions', String(teacherExtra.submissions), 'Checked', String(teacherExtra.graded)],
          [
            'Pending grades',
            String(teacherExtra.pendingGrades),
            'Attendance days',
            String(teacherExtra.attDays),
          ],
          ['Present / Late', String(teacherExtra.present), 'Absent', String(teacherExtra.absent)],
        ],
        ...defaultTableStyles('blue'),
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      });
    }

    y = lastTableY(doc) + 10;
    y = paintSectionTitle(doc, y, 'Lifetime pay summary');
    autoTable(doc, {
      startY: y + 2,
      head: [['Metric', 'Value']],
      body: [
        ['Months recorded', String(history.length)],
        ['Months paid', String(paidHistory.length)],
        ['Months pending', String(pendingHistory.length)],
        ['Lifetime paid', moneyPKR(lifetimePaid)],
        ['Lifetime pending', moneyPKR(lifetimePending)],
        [
          'Average paid month',
          paidHistory.length ? moneyPKR(Math.round(lifetimePaid / paidHistory.length)) : '—',
        ],
        [
          'Highest paid month',
          paidHistory.length
            ? moneyPKR(Math.max(...paidHistory.map((h) => h.amount)))
            : '—',
        ],
      ],
      ...defaultTableStyles('emerald'),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    });

    y = lastTableY(doc) + 10;
    if (y > 220) {
      doc.addPage();
      paintReportHeader(doc, {
        title: 'Staff Person Report',
        subtitle: `${person.name} · pay history`,
        metaLeft: focusLabel,
        metaRight: new Date().toLocaleString(),
        theme: 'slate',
      });
      y = 34;
    }
    y = paintSectionTitle(doc, y, 'Full month-by-month pay history');
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Month', 'Amount', 'Status', 'Paid at', 'Notes']],
      body:
        history.length === 0
          ? [['—', 'No pay records yet', '—', '—', '—', '—']]
          : history.map((h, i) => [
              String(i + 1),
              monthLabel(h.year, h.month),
              moneyPKR(h.amount),
              h.status,
              h.paid_at ? new Date(h.paid_at).toLocaleDateString() : '—',
              h.notes || '—',
            ]),
      ...defaultTableStyles('slate'),
    });

    paintFooters(doc, `BanoQabil LMS · ${person.name}`);
    const slug = person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    doc.save(`banoqabil-staff-${slug}-${exportMonth}.pdf`);
  };

  const handleGenerate = async () => {
    setExporting(true);
    try {
      if (exportMode === 'system') {
        await downloadSystemReportPdf({
          monthValue: exportMonth,
          includeStaffPay: true,
          footerNote: 'BanoQabil LMS · Super Admin · Full System Report',
          theme: 'indigo',
          filePrefix: 'banoqabil-super-system-report',
        });
      } else if (exportMode === 'all') {
        if (previewStats.rows.length === 0) {
          toastError('No staff rows for this filter.');
          return;
        }
        await exportAllStaffReport();
      } else {
        const person = people.find((p) => p.key === exportPersonKey);
        if (!person) {
          toastError('Select a staff member.');
          return;
        }
        await exportPersonReport(person);
      }
      toastSuccess('Report downloaded.');
      setShowExport(false);
    } catch (err: unknown) {
      toastError(err, 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Access denied"
        message="Only Super Admin can open these reports."
      />
    );
  }

  return (
    <div className="min-h-full space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-100">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Super Admin
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
            <p className="mt-1.5 max-w-xl text-sm text-indigo-100/90">
              Download full system intelligence, staff payroll sheets, or a complete person report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              className="gap-2 bg-white text-indigo-950 hover:bg-indigo-50"
              onClick={() => {
                if (!exportPersonKey && people[0]) setExportPersonKey(people[0].key);
                setShowExport(true);
              }}
              disabled={loading}
            >
              <FileDown className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview month
          </label>
          <Input
            type="month"
            className="h-10 w-[11.5rem]"
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Role
          </label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as 'All' | StaffKind)}
          >
            <option value="All">All staff</option>
            <option value="Teacher">Teachers</option>
            <option value="Admin">Admins</option>
            <option value="Other">Other staff</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Pay status
          </label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Paid' | 'Pending')}
          >
            <option value="All">All</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Staff shown
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {loading ? '…' : previewStats.total}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                T {previewStats.byKind.Teacher} · A {previewStats.byKind.Admin} · O{' '}
                {previewStats.byKind.Other}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-700">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paid
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">
                {loading ? '…' : previewStats.paidCount}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {moneyPKR(previewStats.paidAmount)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">
                {loading ? '…' : previewStats.pendingCount}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {moneyPKR(previewStats.pendingAmount)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Month
            </p>
            <p className="mt-2 text-lg font-bold">{monthLabel(previewYear, previewMonth)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Used for payroll & system export</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="border-b bg-muted/20 px-5 py-4">
            <h2 className="text-base font-semibold">Staff payroll preview</h2>
            <p className="text-xs text-muted-foreground">
              Same sheet used in All Staff Pay PDF for the selected month.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : previewStats.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">
                      No staff for this filter.
                    </td>
                  </tr>
                ) : (
                  previewStats.rows.map((r, i) => (
                    <tr key={r.person.key} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.person.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.person.email || r.person.phone || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                          {r.person.kind} · {r.person.jobTitle}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {moneyPKR(r.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            r.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showExport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Export Report</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {exportMode === 'system'
                      ? 'Full system PDF with staff payroll included.'
                      : exportMode === 'all'
                        ? 'All staff month payroll sheet.'
                        : 'One person — full details & pay history.'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowExport(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Report type</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as ExportMode)}
                >
                  <option value="system">Full System Report</option>
                  <option value="all">All Staff Pay</option>
                  <option value="person">Specific Person</option>
                </select>
              </div>

              {exportMode === 'person' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Staff member</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={exportPersonKey}
                    onChange={(e) => setExportPersonKey(e.target.value)}
                  >
                    <option value="">Select person…</option>
                    {people.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name} ({p.kind} · {p.jobTitle})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {exportMode === 'all' ? (
                <p className="text-xs text-muted-foreground">
                  Uses Role / Pay status filters from the page preview.
                </p>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {exportMode === 'person' ? 'Focus month' : 'Month'}
                </label>
                <Input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button className="gap-2" disabled={exporting} onClick={() => void handleGenerate()}>
                  {exporting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {exporting ? 'Generating…' : 'Generate & Download'}
                </Button>
                <Button variant="ghost" disabled={exporting} onClick={() => setShowExport(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

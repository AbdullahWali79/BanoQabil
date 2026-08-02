import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastSuccess, toastError } from '@/lib/notify';
import {
  createReportDoc,
  defaultTableStyles,
  moneyPKR,
  paintFooters,
  paintReportHeader,
  paintSummaryBar,
} from '@/lib/reportPdf';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AccessDenied } from '@/components/layout/AccessDenied';
import {
  FileDown,
  Filter,
  History,
  MessageCircle,
  Receipt,
  Search,
  X,
} from 'lucide-react';

type StudentFeeRow = {
  studentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  applicationId: string | null;
  courseId: string | null;
  courseName: string;
  enrollmentDate: string | null;
  status: string | null;
  initialFee: number;
  monthlyFee: number;
  isFree: boolean;
};

type FeePayment = {
  id: string;
  student_id: string;
  payment_type: 'Initial' | 'Monthly' | 'Adjustment';
  year: number | null;
  month: number | null;
  amount: number;
  status: 'Pending' | 'Paid' | 'Waived';
  paid_at: string | null;
  method: string | null;
  notes: string | null;
};

type CourseOption = { id: string; name: string };

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function toMonthInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseMonthInput(value: string) {
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return currentYearMonth();
  return { year: y, month: m };
}

/** Mask phone for display: 03******78 */
function maskPhone(phone: string | null | undefined): string {
  const raw = (phone || '').replace(/\D/g, '');
  if (!raw) return '—';
  if (raw.length <= 4) return '*'.repeat(raw.length);
  const start = raw.slice(0, 2);
  const end = raw.slice(-2);
  return `${start}${'*'.repeat(Math.max(raw.length - 4, 4))}${end}`;
}

/** Normalize PK mobile for wa.me */
function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  if (!digits.startsWith('92') && digits.length === 10) digits = `92${digits}`;
  if (digits.length < 11) return null;
  return digits;
}

function openWhatsAppPending(phone: string | null, name: string, pending: number, course: string) {
  const num = whatsappNumber(phone);
  if (!num) {
    toastError('Valid phone number not found for WhatsApp.');
    return;
  }
  const text = encodeURIComponent(
    `Assalam o Alaikum ${name},\n\nYeh BanoQabil LMS se reminder hai.\nCourse: ${course}\nAap ki pending fee: Rs ${pending.toLocaleString()}\n\nPlease clear your pending fee soon.\nShukriya.`,
  );
  window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener,noreferrer');
}

export default function StudentFeesPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const canManage = appRole === 'Admin' || appRole === 'Super Admin';
  const { can: canPerm, denyMessage } = usePermission();
  const canExport = canPerm('can_export_pdf');

  const initial = currentYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appIdSearch, setAppIdSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Cleared' | 'Free'>('All');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showFeeExport, setShowFeeExport] = useState(false);
  const [exportScope, setExportScope] = useState<'pending' | 'all'>('pending');
  const [exportMonthValue, setExportMonthValue] = useState(toMonthInputValue(initial.year, initial.month));
  const [exportingFee, setExportingFee] = useState(false);

  const [historyStudent, setHistoryStudent] = useState<StudentFeeRow | null>(null);
  const [payModal, setPayModal] = useState<{
    student: StudentFeeRow;
    paymentType: 'Initial' | 'Monthly';
    amount: string;
    notes: string;
    method: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const selectWithFree = `
              id,
              application_id,
              enrollment_date,
              course_id,
              profiles!inner(id, full_name, email, phone, status),
              courses(id, name, initial_fee, monthly_fee, is_free)
            `;
      const selectWithoutFree = `
              id,
              application_id,
              enrollment_date,
              course_id,
              profiles!inner(id, full_name, email, phone, status),
              courses(id, name, initial_fee, monthly_fee)
            `;

      let studentRows: unknown[] | null = null;
      let sErr: { message: string } | null = null;
      const first = await supabase.from('students').select(selectWithFree).order('id');
      if (first.error && /is_free/i.test(first.error.message)) {
        const second = await supabase.from('students').select(selectWithoutFree).order('id');
        studentRows = second.data;
        sErr = second.error;
      } else {
        studentRows = first.data;
        sErr = first.error;
      }

      const [{ data: payRows, error: pErr }, { data: courseRows, error: cErr }] =
        await Promise.all([
          supabase
            .from('student_fee_payments')
            .select(
              'id, student_id, payment_type, year, month, amount, status, paid_at, method, notes',
            )
            .order('created_at', { ascending: false }),
          supabase.from('courses').select('id, name').order('name'),
        ]);

      if (sErr) throw new Error(sErr.message);
      if (pErr) throw new Error(pErr.message);
      if (cErr) throw new Error(cErr.message);

      const list: StudentFeeRow[] = ((studentRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const profile = relationOne(
            row.profiles as
              | {
                  full_name?: string | null;
                  email?: string | null;
                  phone?: string | null;
                  status?: string | null;
                }
              | {
                  full_name?: string | null;
                  email?: string | null;
                  phone?: string | null;
                  status?: string | null;
                }[]
              | null,
          );
          const course = relationOne(
            row.courses as
              | {
                  id?: string;
                  name?: string;
                  initial_fee?: number | null;
                  monthly_fee?: number | null;
                  is_free?: boolean | null;
                }
              | {
                  id?: string;
                  name?: string;
                  initial_fee?: number | null;
                  monthly_fee?: number | null;
                  is_free?: boolean | null;
                }[]
              | null,
          );
          const isFree = Boolean(course?.is_free);
          return {
            studentId: String(row.id),
            name: profile?.full_name || profile?.email || 'Student',
            phone: profile?.phone ?? null,
            email: profile?.email ?? null,
            applicationId: (row.application_id as string | null) ?? null,
            courseId: (row.course_id as string | null) ?? course?.id ?? null,
            courseName: course?.name || 'No Course',
            enrollmentDate: (row.enrollment_date as string | null) ?? null,
            status: profile?.status ?? null,
            initialFee: isFree ? 0 : Number(course?.initial_fee ?? 0),
            monthlyFee: isFree ? 0 : Number(course?.monthly_fee ?? 0),
            isFree,
          };
        })
        .filter((s) => s.status === 'Approved');

      setStudents(list);
      setCourses(
        ((courseRows ?? []) as Array<{ id: string; name: string }>).map((c) => ({
          id: c.id,
          name: c.name,
        })),
      );
      setPayments(
        ((payRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          student_id: String(row.student_id),
          payment_type: row.payment_type as FeePayment['payment_type'],
          year: row.year == null ? null : Number(row.year),
          month: row.month == null ? null : Number(row.month),
          amount: Number(row.amount ?? 0),
          status: (row.status as FeePayment['status']) || 'Paid',
          paid_at: (row.paid_at as string | null) ?? null,
          method: (row.method as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
        })),
      );
    } catch (err: unknown) {
      setStudents([]);
      setPayments([]);
      setCourses([]);
      toastError(err, 'Failed to load fees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void loadData();
  }, [canManage, loadData]);

  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, FeePayment[]>();
    for (const p of payments) {
      const list = map.get(p.student_id) ?? [];
      list.push(p);
      map.set(p.student_id, list);
    }
    return map;
  }, [payments]);

  /** Pending = unpaid initial + unpaid fee for selected month only (actual ledger). */
  const computeBalance = useCallback(
    (student: StudentFeeRow) => {
      if (student.isFree || (student.initialFee <= 0 && student.monthlyFee <= 0)) {
        const pays = paymentsByStudent.get(student.studentId) ?? [];
        const totalPaid = pays
          .filter((p) => p.status === 'Paid')
          .reduce((s, p) => s + p.amount, 0);
        return {
          initialDue: 0,
          monthlyDue: 0,
          pending: 0,
          totalPaid,
          thisMonthPaid: true,
          initialPaid: true,
          monthPaidAmount: 0,
        };
      }

      const pays = paymentsByStudent.get(student.studentId) ?? [];
      const paidInitial = pays
        .filter((p) => p.payment_type === 'Initial' && p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);
      const initialDue = Math.max(0, student.initialFee - paidInitial);

      const paidThisMonth = pays
        .filter(
          (p) =>
            p.payment_type === 'Monthly' &&
            p.status === 'Paid' &&
            p.year === year &&
            p.month === month,
        )
        .reduce((s, p) => s + p.amount, 0);
      const monthlyDue = Math.max(0, student.monthlyFee - paidThisMonth);

      const adjustmentPaid = pays
        .filter((p) => p.payment_type === 'Adjustment' && p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);

      const pending = Math.max(0, initialDue + monthlyDue - adjustmentPaid);
      const totalPaid = pays
        .filter((p) => p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);

      return {
        initialDue,
        monthlyDue,
        pending,
        totalPaid,
        thisMonthPaid: student.monthlyFee <= 0 ? true : paidThisMonth >= student.monthlyFee,
        initialPaid: student.initialFee <= 0 ? true : paidInitial >= student.initialFee,
        monthPaidAmount: paidThisMonth,
      };
    },
    [paymentsByStudent, year, month],
  );

  const allBalances = useMemo(
    () => students.map((s) => ({ student: s, balance: computeBalance(s) })),
    [students, computeBalance],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const idQ = appIdSearch.trim().toLowerCase();

    return allBalances.filter(({ student, balance }) => {
      if (courseFilter !== 'all' && student.courseId !== courseFilter) return false;
      if (statusFilter === 'Pending' && balance.pending <= 0) return false;
      if (statusFilter === 'Cleared' && (balance.pending > 0 || student.isFree)) return false;
      if (statusFilter === 'Free' && !student.isFree) return false;
      if (idQ) {
        const appId = (student.applicationId || '').toLowerCase();
        if (!appId.includes(idQ)) return false;
      }
      if (!q) return true;
      return (
        student.name.toLowerCase().includes(q) ||
        (student.email || '').toLowerCase().includes(q) ||
        (student.applicationId || '').toLowerCase().includes(q) ||
        student.courseName.toLowerCase().includes(q)
      );
    });
  }, [allBalances, search, appIdSearch, courseFilter, statusFilter]);

  const stats = useMemo(() => {
    const money = (n: unknown) => {
      const v = Number(n);
      return Number.isFinite(v) ? v : 0;
    };

    const pendingCount = rows.filter((r) => r.balance.pending > 0).length;
    const clearedCount = rows.filter((r) => r.balance.pending <= 0 && !r.student.isFree).length;
    const freeCount = rows.filter((r) => r.student.isFree).length;
    const pendingInitial = rows.reduce((s, r) => s + money(r.balance.initialDue), 0);
    const pendingMonthly = rows.reduce((s, r) => s + money(r.balance.monthlyDue), 0);
    const pendingTotal = rows.reduce((s, r) => s + money(r.balance.pending), 0);

    // Expected monthly bill for filtered students
    const monthExpected = rows.reduce((s, r) => {
      if (r.student.isFree) return s;
      return s + money(r.student.monthlyFee);
    }, 0);

    // Actual amount paid toward this month's fee (capped by course monthly fee — not raw ledger rows)
    const monthReceived = rows.reduce((s, r) => {
      if (r.student.isFree) return s;
      const paid = Math.max(0, money(r.student.monthlyFee) - money(r.balance.monthlyDue));
      return s + Math.min(money(r.student.monthlyFee), paid);
    }, 0);

    // Cleared = paid initial + paid this month (from balances, not inflated payment rows)
    const clearedAmount = rows.reduce((s, r) => {
      if (r.student.isFree) return s;
      const paidInit = Math.max(0, money(r.student.initialFee) - money(r.balance.initialDue));
      const paidMonth = Math.max(0, money(r.student.monthlyFee) - money(r.balance.monthlyDue));
      return s + paidInit + paidMonth;
    }, 0);

    return {
      students: students.length,
      showing: rows.length,
      pendingCount,
      clearedCount,
      freeCount,
      pendingTotal,
      pendingInitial,
      pendingMonthly,
      monthExpected,
      monthReceived,
      clearedAmount,
    };
  }, [rows, students]);

  const recordPayment = async () => {
    if (!payModal) return;
    const amount = Number(payModal.amount);
    if (Number.isNaN(amount) || amount < 0) {
      toastError('Enter a valid amount.');
      return;
    }
    setSavingId(payModal.student.studentId);
    try {
      const payload: Record<string, unknown> = {
        student_id: payModal.student.studentId,
        payment_type: payModal.paymentType,
        amount,
        status: 'Paid',
        paid_at: new Date().toISOString(),
        recorded_by: user?.id ?? null,
        method: payModal.method.trim() || null,
        notes: payModal.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (payModal.paymentType === 'Monthly') {
        payload.year = year;
        payload.month = month;
      } else {
        payload.year = null;
        payload.month = null;
      }

      const existing = (paymentsByStudent.get(payModal.student.studentId) ?? []).find((p) => {
        if (payModal.paymentType === 'Initial') {
          return p.payment_type === 'Initial' && p.status === 'Paid';
        }
        return p.payment_type === 'Monthly' && p.year === year && p.month === month;
      });

      if (existing) {
        const { error } = await supabase
          .from('student_fee_payments')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('student_fee_payments').insert(payload);
        if (error) throw new Error(error.message);
      }

      toastSuccess('Fee recorded.');
      setPayModal(null);
      await loadData();
    } catch (err: unknown) {
      toastError(err, 'Failed to save payment.');
    } finally {
      setSavingId(null);
    }
  };

  const balanceForMonth = useCallback(
    (student: StudentFeeRow, y: number, m: number) => {
      if (student.isFree || (student.initialFee <= 0 && student.monthlyFee <= 0)) {
        return { initialDue: 0, monthlyDue: 0, pending: 0, status: 'Free' as const };
      }
      const pays = paymentsByStudent.get(student.studentId) ?? [];
      const paidInitial = pays
        .filter((p) => p.payment_type === 'Initial' && p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);
      const initialDue = Math.max(0, student.initialFee - paidInitial);
      const paidThisMonth = pays
        .filter(
          (p) =>
            p.payment_type === 'Monthly' &&
            p.status === 'Paid' &&
            p.year === y &&
            p.month === m,
        )
        .reduce((s, p) => s + p.amount, 0);
      const monthlyDue = Math.max(0, student.monthlyFee - paidThisMonth);
      const adjustmentPaid = pays
        .filter((p) => p.payment_type === 'Adjustment' && p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);
      const pending = Math.max(0, initialDue + monthlyDue - adjustmentPaid);
      return {
        initialDue,
        monthlyDue,
        pending,
        status: pending > 0 ? ('Pending' as const) : ('Cleared' as const),
      };
    },
    [paymentsByStudent],
  );

  const handleExportFeeReport = async () => {
    const { year: ey, month: em } = parseMonthInput(exportMonthValue);
    setExportingFee(true);
    try {
      let exportRows = students.map((s) => ({
        student: s,
        balance: balanceForMonth(s, ey, em),
      }));
      if (exportScope === 'pending') {
        exportRows = exportRows.filter((r) => r.balance.pending > 0);
      }

      if (exportRows.length === 0) {
        toastError(
          exportScope === 'pending'
            ? 'No pending fees for this month.'
            : 'No students to export.',
        );
        return;
      }

      const { doc, autoTable } = await createReportDoc('landscape');
      const label = monthLabel(ey, em);
      const pendingTotal = exportRows.reduce((s, r) => s + r.balance.pending, 0);

      paintReportHeader(doc, {
        title: 'Student Fee Report',
        subtitle:
          exportScope === 'pending' ? 'Pending fees only' : 'All approved students',
        metaLeft: label,
        metaRight: new Date().toLocaleString(),
        theme: 'emerald',
      });

      paintSummaryBar(
        doc,
        34,
        [
          `Students ${exportRows.length}`,
          `Pending total ${moneyPKR(pendingTotal)}`,
          label,
        ],
        'emerald',
      );

      autoTable(doc, {
        startY: 52,
        head: [
          [
            '#',
            'App ID',
            'Student',
            'Email',
            'Course',
            'Phone',
            'Initial due',
            'Monthly due',
            'Pending',
            'Status',
          ],
        ],
        body: exportRows.map((r, i) => [
          String(i + 1),
          r.student.applicationId || '—',
          r.student.name,
          r.student.email || '—',
          r.student.courseName,
          r.student.phone || '—',
          r.student.isFree ? 'Free' : moneyPKR(r.balance.initialDue),
          r.student.isFree ? 'Free' : moneyPKR(r.balance.monthlyDue),
          r.student.isFree ? '—' : moneyPKR(r.balance.pending),
          r.balance.status,
        ]),
        ...defaultTableStyles('emerald'),
        columnStyles: {
          2: { cellWidth: 36 },
          3: { cellWidth: 48 },
          4: { cellWidth: 38 },
        },
      });

      paintFooters(doc, 'BanoQabil LMS · Admin · Fee Report');

      const scopeSlug = exportScope === 'pending' ? 'pending' : 'all';
      doc.save(`banoqabil-fee-report-${toMonthInputValue(ey, em)}-${scopeSlug}.pdf`);
      toastSuccess('Fee report downloaded.');
      setShowFeeExport(false);
    } catch (err: unknown) {
      toastError(err, 'Export failed.');
    } finally {
      setExportingFee(false);
    }
  };

  if (!canManage) {
    return (
      <AccessDenied
        title="Access denied"
        message="Only Admin can manage student fees."
      />
    );
  }

  const shortMonth = monthLabel(year, month).split(' ')[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-emerald-600 p-2.5 text-white shadow-sm">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Student Fees</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              Payments, month dues, history & WhatsApp reminders
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-end gap-2 sm:flex-nowrap">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Month
            </label>
            <Input
              type="month"
              className="h-10 w-[11.5rem] bg-background"
              value={toMonthInputValue(year, month)}
              onChange={(e) => {
                const next = parseMonthInput(e.target.value);
                setYear(next.year);
                setMonth(next.month);
              }}
            />
          </div>
          <Button
            className="h-10 gap-2"
            onClick={() => {
              if (!canExport) {
                toastError(denyMessage('can_export_pdf'));
                return;
              }
              setExportMonthValue(toMonthInputValue(year, month));
              setShowFeeExport(true);
            }}
          >
            <FileDown className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Students
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.showing}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            of {stats.students} approved
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            With pending
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
            {stats.pendingCount}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cleared {stats.clearedCount}
            {stats.freeCount ? ` · Free ${stats.freeCount}` : ''}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending total
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
            Rs {stats.pendingTotal.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Initial Rs {stats.pendingInitial.toLocaleString()} · {shortMonth} Rs{' '}
            {stats.pendingMonthly.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {shortMonth} expected
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            Rs {stats.monthExpected.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total monthly fees due</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/70">
            {shortMonth} received
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
            Rs {stats.monthReceived.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800/70">
            Paid of {shortMonth} fees (max Rs {stats.monthExpected.toLocaleString()})
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cleared total
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
            Rs {stats.clearedAmount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paid initial + {shortMonth} fee
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Search name, email, course…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9 font-mono"
                  placeholder="App ID (partial ok)"
                  value={appIdSearch}
                  onChange={(e) => setAppIdSearch(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="all">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="All">All statuses</option>
                <option value="Pending">Pending only</option>
                <option value="Cleared">Cleared</option>
                <option value="Free">Free courses</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Initial</th>
                  <th className="px-4 py-3 font-semibold">{shortMonth} fee</th>
                  <th className="px-4 py-3 font-semibold">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-muted-foreground">
                      No matching approved students. Adjust filters or set course fees.
                    </td>
                  </tr>
                ) : (
                  rows.map(({ student, balance }) => (
                    <tr key={student.studentId} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          ID {student.applicationId || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{student.courseName}</p>
                        {student.isFree ? (
                          <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            Free
                          </span>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Init Rs {student.initialFee.toLocaleString()} · Mo Rs{' '}
                            {student.monthlyFee.toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                        {maskPhone(student.phone)}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {student.isFree ? (
                          <span className="text-emerald-700">—</span>
                        ) : (
                          <span
                            className={
                              balance.initialDue > 0
                                ? 'font-semibold text-amber-700'
                                : 'font-medium text-emerald-700'
                            }
                          >
                            {balance.initialDue > 0
                              ? `Due Rs ${balance.initialDue.toLocaleString()}`
                              : 'Paid'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {student.isFree || student.monthlyFee <= 0 ? (
                          <span className="text-emerald-700">—</span>
                        ) : (
                          <span
                            className={
                              balance.monthlyDue > 0
                                ? 'font-semibold text-amber-700'
                                : 'font-medium text-emerald-700'
                            }
                          >
                            {balance.monthlyDue > 0
                              ? `Due Rs ${balance.monthlyDue.toLocaleString()}`
                              : 'Paid'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex min-w-[5.5rem] justify-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                            balance.pending > 0
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Rs {balance.pending.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {student.isFree ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setHistoryStudent(student)}
                            >
                              <History className="h-3.5 w-3.5" />
                              History
                            </Button>
                          ) : (
                            <>
                              {!balance.initialPaid ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPayModal({
                                      student,
                                      paymentType: 'Initial',
                                      amount: String(balance.initialDue || student.initialFee),
                                      notes: '',
                                      method: 'Cash',
                                    })
                                  }
                                >
                                  Pay Initial
                                </Button>
                              ) : null}
                              {student.monthlyFee > 0 && !balance.thisMonthPaid ? (
                                <Button
                                  size="sm"
                                  disabled={savingId === student.studentId}
                                  onClick={() =>
                                    setPayModal({
                                      student,
                                      paymentType: 'Monthly',
                                      amount: String(balance.monthlyDue || student.monthlyFee),
                                      notes: '',
                                      method: 'Cash',
                                    })
                                  }
                                >
                                  Pay {shortMonth}
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => setHistoryStudent(student)}
                              >
                                <History className="h-3.5 w-3.5" />
                                History
                              </Button>
                              {balance.pending > 0 ? (
                                <Button
                                  size="sm"
                                  className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() =>
                                    openWhatsAppPending(
                                      student.phone,
                                      student.name,
                                      balance.pending,
                                      student.courseName,
                                    )
                                  }
                                  title="Send WhatsApp reminder"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  WhatsApp
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Pending = unpaid <strong>initial</strong> + unpaid fee for the <strong>selected month</strong>{' '}
            only. Collected comes from saved payment records. Mark a course as Free in Courses &amp;
            Batches to skip fees.
          </p>
        </CardContent>
      </Card>

      {payModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto border-none shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Record {payModal.paymentType} Fee</h2>
                  <p className="text-sm text-muted-foreground">
                    {payModal.student.name}
                    {payModal.paymentType === 'Monthly'
                      ? ` · ${monthLabel(year, month)}`
                      : ' · Admission / Initial'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPayModal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (Rs)</label>
                <Input
                  type="number"
                  min="0"
                  value={payModal.amount}
                  onChange={(e) =>
                    setPayModal((m) => (m ? { ...m, amount: e.target.value } : m))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Method</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={payModal.method}
                  onChange={(e) =>
                    setPayModal((m) => (m ? { ...m, method: e.target.value } : m))
                  }
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>JazzCash</option>
                  <option>EasyPaisa</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={payModal.notes}
                  onChange={(e) =>
                    setPayModal((m) => (m ? { ...m, notes: e.target.value } : m))
                  }
                  placeholder="Optional note"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayModal(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void recordPayment()}
                  disabled={savingId === payModal.student.studentId}
                >
                  {savingId === payModal.student.studentId ? 'Saving…' : 'Save Payment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {historyStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Fee History</h2>
                  <p className="text-sm text-muted-foreground">
                    {historyStudent.name} · {historyStudent.courseName} · Phone{' '}
                    {maskPhone(historyStudent.phone)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setHistoryStudent(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Period</th>
                      <th className="px-3 py-2.5">Amount</th>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Note</th>
                      <th className="px-3 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paymentsByStudent.get(historyStudent.studentId) ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      (paymentsByStudent.get(historyStudent.studentId) ?? []).map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2.5 font-medium">{p.payment_type}</td>
                          <td className="px-3 py-2.5">
                            {p.payment_type === 'Monthly' && p.year && p.month
                              ? monthLabel(p.year, p.month)
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5">Rs {p.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5">{p.method || '—'}</td>
                          <td className="px-3 py-2.5 max-w-[12rem]">
                            <p className="whitespace-pre-wrap">{p.notes || '—'}</p>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setHistoryStudent(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showFeeExport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Export Fee Report</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Download PDF after selecting scope and month.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowFeeExport(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Students</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as 'pending' | 'all')}
                >
                  <option value="pending">Pending fees only</option>
                  <option value="all">All students</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Input
                  type="month"
                  value={exportMonthValue}
                  onChange={(e) => setExportMonthValue(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  className="gap-2"
                  disabled={exportingFee}
                  onClick={() => void handleExportFeeReport()}
                >
                  {exportingFee ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {exportingFee ? 'Generating…' : 'Generate & Download'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowFeeExport(false)}
                  disabled={exportingFee}
                >
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastSuccess, toastError } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole, SUPER_ADMIN_EMAIL } from '@/lib/roles';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AccessDenied } from '@/components/layout/AccessDenied';
import {
  Banknote,
  CheckCircle2,
  Clock,
  History,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
  Pencil,
} from 'lucide-react';

type StaffKind = 'Teacher' | 'Admin' | 'Other';

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

type OtherStaffForm = {
  full_name: string;
  phone: string;
  job_title: string;
  monthly_salary: string;
  notes: string;
};

const emptyOtherForm: OtherStaffForm = {
  full_name: '',
  phone: '',
  job_title: 'Cleaner',
  monthly_salary: '',
  notes: '',
};

const JOB_PRESETS = ['Cleaner', 'Guard', 'Peon', 'Driver', 'Receptionist', 'Other'];

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

export default function StaffPayPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const isSuperAdmin = appRole === 'Super Admin';

  const initial = currentYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [people, setPeople] = useState<PayPerson[]>([]);
  const [allPayHistory, setAllPayHistory] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'All' | StaffKind>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PayPerson | null>(null);
  const [staffForm, setStaffForm] = useState<OtherStaffForm>(emptyOtherForm);
  const [staffSaving, setStaffSaving] = useState(false);

  const [historyPerson, setHistoryPerson] = useState<PayPerson | null>(null);
  const [payModal, setPayModal] = useState<{
    person: PayPerson;
    amount: string;
    notes: string;
    status: 'Paid' | 'Pending';
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profileError }, { data: otherStaff, error: staffError }, { data: pays, error: payError }] =
        await Promise.all([
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
          };
        })
        .filter(Boolean) as PayPerson[];

      const profileMap = new Map<string, PayPerson>();
      for (const p of fromProfiles) {
        if (p.profileId) profileMap.set(p.profileId, p);
      }

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
          isActive: true,
        }),
      );

      setPeople([...profileMap.values(), ...fromOther]);
      setAllPayHistory(
        ((pays ?? []) as Array<Record<string, unknown>>)
          .map((row) => ({
            id: String(row.id),
            profile_id: (row.profile_id as string | null) ?? null,
            staff_member_id: (row.staff_member_id as string | null) ?? null,
            year: Number(row.year),
            month: Number(row.month),
            amount: Number(row.amount ?? 0),
            status: (row.status as 'Pending' | 'Paid') || 'Pending',
            paid_at: (row.paid_at as string | null) ?? null,
            notes: (row.notes as string | null) ?? null,
          }))
          .sort((a, b) => b.year - a.year || b.month - a.month),
      );
    } catch (err: unknown) {
      setPeople([]);
      setAllPayHistory([]);
      toastError(err, 'Failed to load staff pay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadData();
  }, [isSuperAdmin, loadData]);

  const payByKey = useMemo(() => {
    const map = new Map<string, PayRow>();
    for (const row of allPayHistory) {
      if (row.year !== year || row.month !== month) continue;
      if (row.profile_id) map.set(`profile:${row.profile_id}`, row);
      if (row.staff_member_id) map.set(`staff:${row.staff_member_id}`, row);
    }
    return map;
  }, [allPayHistory, year, month]);

  const historyForPerson = useCallback(
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .filter((p) => (kindFilter === 'All' ? true : p.kind === kindFilter))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          p.jobTitle.toLowerCase().includes(q)
        );
      })
      .map((p) => {
        const pay = payByKey.get(p.key);
        const status: 'Paid' | 'Pending' = pay?.status === 'Paid' ? 'Paid' : 'Pending';
        const amount = pay?.amount ?? p.defaultSalary ?? 0;
        return { person: p, pay, status, amount };
      })
      .filter((r) => (statusFilter === 'All' ? true : r.status === statusFilter));
  }, [people, payByKey, search, kindFilter, statusFilter]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.status === 'Paid');
    const pending = rows.filter((r) => r.status === 'Pending');
    const paidTotal = paid.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const pendingTotal = pending.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return {
      total: rows.length,
      paid: paid.length,
      pending: pending.length,
      paidTotal,
      pendingTotal,
    };
  }, [rows]);

  const upsertPay = async (
    person: PayPerson,
    next: {
      status: 'Paid' | 'Pending';
      amount: number;
      notes?: string | null;
      year?: number;
      month?: number;
    },
  ) => {
    const targetYear = next.year ?? year;
    const targetMonth = next.month ?? month;
    setSavingKey(person.key);
    try {
      const existing = allPayHistory.find((row) => {
        if (row.year !== targetYear || row.month !== targetMonth) return false;
        if (person.profileId) return row.profile_id === person.profileId;
        return row.staff_member_id === person.staffMemberId;
      });

      const patch = {
        year: targetYear,
        month: targetMonth,
        amount: next.amount,
        status: next.status,
        paid_at: next.status === 'Paid' ? new Date().toISOString() : null,
        paid_by: next.status === 'Paid' ? user?.id ?? null : null,
        notes: next.notes !== undefined ? next.notes : existing?.notes ?? null,
        profile_id: person.profileId,
        staff_member_id: person.staffMemberId,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('staff_monthly_pay')
          .update(patch)
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('staff_monthly_pay').insert(patch);
        if (error) throw new Error(error.message);
      }

      toastSuccess(next.status === 'Paid' ? 'Payment saved.' : 'Marked as pending.');
      setPayModal(null);
      await loadData();
    } catch (err: unknown) {
      toastError(err, 'Failed to update pay.');
    } finally {
      setSavingKey(null);
    }
  };

  const openPayModal = (person: PayPerson, status: 'Paid' | 'Pending') => {
    const existing = payByKey.get(person.key);
    setPayModal({
      person,
      status,
      amount: String(existing?.amount ?? person.defaultSalary ?? ''),
      notes: existing?.notes || '',
    });
  };

  const submitPayModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    const amount = Number(payModal.amount);
    if (Number.isNaN(amount) || amount < 0) {
      toastError('Enter a valid amount.');
      return;
    }
    await upsertPay(payModal.person, {
      status: payModal.status,
      amount,
      notes: payModal.notes.trim() || null,
    });
  };

  const saveAmount = async (person: PayPerson, amountStr: string) => {
    const amount = Number(amountStr);
    if (Number.isNaN(amount) || amount < 0) {
      toastError('Enter a valid amount.');
      return;
    }
    const existing = payByKey.get(person.key);
    await upsertPay(person, {
      status: existing?.status === 'Paid' ? 'Paid' : 'Pending',
      amount,
      notes: existing?.notes,
    });
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm(emptyOtherForm);
    setShowAddStaff(true);
  };

  const openEditStaff = (person: PayPerson) => {
    if (person.kind !== 'Other' || !person.staffMemberId) return;
    setEditingStaff(person);
    setStaffForm({
      full_name: person.name,
      phone: person.phone || '',
      job_title: person.jobTitle,
      monthly_salary: person.defaultSalary != null ? String(person.defaultSalary) : '',
      notes: '',
    });
    setShowAddStaff(true);
  };

  const saveOtherStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const full_name = staffForm.full_name.trim();
    const job_title = staffForm.job_title.trim() || 'Staff';
    if (!full_name) {
      toastError('Name is required.');
      return;
    }
    setStaffSaving(true);
    try {
      const payload = {
        full_name,
        phone: staffForm.phone.trim() || null,
        job_title,
        monthly_salary:
          staffForm.monthly_salary.trim() === ''
            ? null
            : Number(staffForm.monthly_salary),
        notes: staffForm.notes.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (payload.monthly_salary != null && Number.isNaN(payload.monthly_salary)) {
        throw new Error('Salary must be a number.');
      }

      if (editingStaff?.staffMemberId) {
        const { error } = await supabase
          .from('staff_members')
          .update(payload)
          .eq('id', editingStaff.staffMemberId);
        if (error) throw new Error(error.message);
        toastSuccess('Staff updated.');
      } else {
        const { error } = await supabase.from('staff_members').insert(payload);
        if (error) throw new Error(error.message);
        toastSuccess('Staff added.');
      }
      setShowAddStaff(false);
      setEditingStaff(null);
      setStaffForm(emptyOtherForm);
      await loadData();
    } catch (err: unknown) {
      toastError(err, 'Failed to save staff.');
    } finally {
      setStaffSaving(false);
    }
  };

  const deactivateStaff = async (person: PayPerson) => {
    if (person.kind !== 'Other' || !person.staffMemberId) return;
    const ok = await askConfirm({
      title: 'Remove staff member?',
      description: `Are you sure you want to remove "${person.name}" from the other staff list?\n\nThey will be marked inactive and hidden from payroll.`,
      confirmLabel: 'Yes, remove staff',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase
      .from('staff_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', person.staffMemberId);
    if (error) {
      toastError(error, 'Something went wrong.');
      return;
    }
    toastSuccess('Staff deactivated.');
    await loadData();
  };

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Access denied"
        message="Only Super Admin can manage staff pay."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-blue-50 p-2 text-blue-700">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Staff Pay</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track monthly pay for teachers, admins, and other staff. Teachers &amp; admins are
              listed from accounts — add only cleaners and other staff here.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            className="h-10 w-[11.5rem]"
            value={toMonthInputValue(year, month)}
            onChange={(e) => {
              const next = parseMonthInput(e.target.value);
              setYear(next.year);
              setMonth(next.month);
            }}
          />
          <Button className="gap-2" onClick={openAddStaff}>
            <UserPlus className="h-4 w-4" /> Add Other Staff
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Staff this month</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground">{monthLabel(year, month)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{stats.paid}</p>
            <p className="text-[11px] text-muted-foreground">
              Rs {stats.paidTotal.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.pending}</p>
            <p className="text-[11px] text-muted-foreground">
              Rs {stats.pendingTotal.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Other staff</p>
            <p className="mt-1 text-2xl font-bold">
              {people.filter((p) => p.kind === 'Other' && p.isActive).length}
            </p>
            <p className="text-[11px] text-muted-foreground">Cleaners & more</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, phone, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
              >
                <option value="All">All types</option>
                <option value="Teacher">Teachers</option>
                <option value="Admin">Admins</option>
                <option value="Other">Other staff</option>
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="All">All status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Amount (Rs)</th>
                  <th className="px-4 py-3">Status / Note</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No staff found for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map(({ person, pay, status, amount }) => (
                    <tr key={person.key} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{person.name}</p>
                        <p className="text-xs text-muted-foreground">{person.jobTitle}</p>
                        {!person.isActive && person.kind !== 'Other' ? (
                          <p className="text-[11px] text-amber-700">Account not Approved</p>
                        ) : null}
                        {person.kind === 'Other' && !person.isActive ? (
                          <p className="text-[11px] text-amber-700">Inactive</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            person.kind === 'Teacher'
                              ? 'bg-blue-50 text-blue-700'
                              : person.kind === 'Admin'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {person.kind === 'Other' ? person.jobTitle : person.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{person.phone || '—'}</p>
                        <p className="text-xs text-muted-foreground">{person.email || 'No login'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <form
                          className="flex max-w-[10rem] items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            void saveAmount(person, String(fd.get('amount') || '0'));
                          }}
                        >
                          <Input
                            name="amount"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={amount || ''}
                            key={`${person.key}-${pay?.id || 'new'}-${amount}`}
                            className="h-9"
                            placeholder="0"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={savingKey === person.key}
                            title="Save amount"
                          >
                            Save
                          </Button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            status === 'Paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {status === 'Paid' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {status}
                        </span>
                        {pay?.paid_at ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(pay.paid_at).toLocaleDateString()}
                          </p>
                        ) : null}
                        {pay?.notes ? (
                          <p className="mt-1 max-w-[12rem] truncate text-xs text-slate-600" title={pay.notes}>
                            Note: {pay.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setHistoryPerson(person)}
                            title="All months history"
                          >
                            <History className="h-3.5 w-3.5" />
                            History
                          </Button>
                          {status === 'Paid' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingKey === person.key}
                              onClick={() => openPayModal(person, 'Pending')}
                            >
                              Mark Pending
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={savingKey === person.key}
                              onClick={() => openPayModal(person, 'Paid')}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {person.kind === 'Other' ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Edit staff"
                                onClick={() => openEditStaff(person)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                title="Remove staff"
                                onClick={() => void deactivateStaff(person)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Teachers and Admins are managed in their own tabs. Use <strong>Add Other Staff</strong>{' '}
            only for cleaners, guards, and similar roles. Click <strong>History</strong> to see all
            previous months with amount and notes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold">All Months Pay Ledger</h2>
            <p className="text-sm text-muted-foreground">
              Complete record of every month — who was paid how much, with notes.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Paid on</th>
                </tr>
              </thead>
              <tbody>
                {allPayHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No pay records yet. Mark someone Paid to start the ledger.
                    </td>
                  </tr>
                ) : (
                  allPayHistory.map((row) => {
                    const person = people.find((p) =>
                      row.profile_id
                        ? p.profileId === row.profile_id
                        : p.staffMemberId === row.staff_member_id,
                    );
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-3 font-medium">
                          {monthLabel(row.year, row.month)}
                        </td>
                        <td className="px-4 py-3">{person?.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {person?.kind === 'Other'
                            ? person.jobTitle
                            : person?.kind || '—'}
                        </td>
                        <td className="px-4 py-3">Rs {Number(row.amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              row.status === 'Paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[16rem]">
                          <p className="truncate text-sm" title={row.notes || ''}>
                            {row.notes || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'}
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

      {payModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {payModal.status === 'Paid' ? 'Mark Paid' : 'Mark Pending'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {payModal.person.name} · {monthLabel(year, month)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPayModal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <form className="space-y-4" onSubmit={submitPayModal}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (Rs)</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={payModal.amount}
                    onChange={(e) =>
                      setPayModal((m) => (m ? { ...m, amount: e.target.value } : m))
                    }
                    placeholder="e.g. 25000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note</label>
                  <textarea
                    className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={payModal.notes}
                    onChange={(e) =>
                      setPayModal((m) => (m ? { ...m, notes: e.target.value } : m))
                    }
                    placeholder="e.g. Cash paid / Bank transfer / Advance deducted…"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPayModal(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingKey === payModal.person.key}>
                    {savingKey === payModal.person.key
                      ? 'Saving…'
                      : payModal.status === 'Paid'
                        ? 'Confirm Paid'
                        : 'Save Pending'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {historyPerson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Pay History</h2>
                  <p className="text-sm text-muted-foreground">
                    {historyPerson.name} · {historyPerson.jobTitle}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setHistoryPerson(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Month</th>
                      <th className="px-3 py-2.5">Amount</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Note</th>
                      <th className="px-3 py-2.5">Paid on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyForPerson(historyPerson).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No month records yet for this staff.
                        </td>
                      </tr>
                    ) : (
                      historyForPerson(historyPerson).map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2.5 font-medium">
                            {monthLabel(row.year, row.month)}
                          </td>
                          <td className="px-3 py-2.5">
                            Rs {Number(row.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.status === 'Paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 max-w-[14rem]">
                            <p className="whitespace-pre-wrap text-sm">{row.notes || '—'}</p>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setHistoryPerson(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showAddStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {editingStaff ? 'Edit Other Staff' : 'Add Other Staff'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Not for Teachers or Admins — use Teachers / Admins pages for those.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddStaff(false);
                    setEditingStaff(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form className="space-y-4" onSubmit={saveOtherStaff}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={staffForm.full_name}
                    onChange={(e) => setStaffForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                    placeholder="Staff name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Title</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={
                      JOB_PRESETS.includes(staffForm.job_title) ? staffForm.job_title : 'Other'
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setStaffForm((f) => ({
                        ...f,
                        job_title: v === 'Other' ? (f.job_title === 'Other' ? '' : f.job_title) : v,
                      }));
                    }}
                  >
                    {JOB_PRESETS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                  {!JOB_PRESETS.slice(0, -1).includes(staffForm.job_title) ? (
                    <Input
                      className="mt-2"
                      placeholder="Custom title"
                      value={staffForm.job_title === 'Other' ? '' : staffForm.job_title}
                      onChange={(e) =>
                        setStaffForm((f) => ({ ...f, job_title: e.target.value || 'Other' }))
                      }
                    />
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Monthly Salary (Rs)</label>
                    <Input
                      type="number"
                      min="0"
                      value={staffForm.monthly_salary}
                      onChange={(e) =>
                        setStaffForm((f) => ({ ...f, monthly_salary: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={staffForm.notes}
                    onChange={(e) => setStaffForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddStaff(false);
                      setEditingStaff(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={staffSaving} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {staffSaving ? 'Saving…' : editingStaff ? 'Save Changes' : 'Add Staff'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

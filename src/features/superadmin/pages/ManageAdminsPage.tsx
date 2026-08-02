import { useEffect, useMemo, useState } from 'react';
import { supabase, createEphemeralAuthClient } from '@/lib/supabase';
import { toastSuccess, toastError } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { AccessDenied } from '@/components/layout/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  CheckCircle,
  XCircle,
  Settings2,
  KeyRound,
  Trash2,
  Plus,
  Edit,
  X,
  Search,
} from 'lucide-react';
import { adminSetUserEmail, adminSetUserPassword } from '@/lib/adminPassword';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole, PRIMARY_ADMIN_EMAIL, SUPER_ADMIN_EMAIL } from '@/lib/roles';
import {
  ADMIN_PERMISSION_KEYS,
  ALL_PERMISSIONS_TRUE,
  countGranted,
  normalizePermissions,
} from '@/lib/permissions';
import { relationOne } from '@/features/teacher/utils/teacherData';

type AdminRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  permissions: Record<string, boolean> | null;
};

const emptyAdd = { full_name: '', email: '', phone: '', password: '', confirmPassword: '' };
const emptyEdit = { full_name: '', email: '', phone: '', status: 'Approved' };

export default function ManageAdminsPage() {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const isSuperAdmin = appRole === 'Super Admin';

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminRoleId, setAdminRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Approved' | 'Suspended' | 'Pending'>('All');
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);

  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  const [permsAdmin, setPermsAdmin] = useState<AdminRow | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  const [resetAdmin, setResetAdmin] = useState<AdminRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, status, permissions, roles!inner(name)')
      .eq('roles.name', 'Admin')
      .order('full_name');

    if (error) {
      setAdmins([]);
      toastError(error, 'Something went wrong.');
    } else {
      const list = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const roles = relationOne(row.roles as { name: string } | { name: string }[] | null);
          if (roles?.name !== 'Admin') return null;
          const email = String(row.email || '').toLowerCase();
          if (email === SUPER_ADMIN_EMAIL) return null;
          return {
            id: String(row.id),
            full_name: (row.full_name as string | null) ?? null,
            email: (row.email as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
            status: (row.status as string | null) ?? null,
            permissions: (row.permissions as Record<string, boolean> | null) ?? null,
          } satisfies AdminRow;
        })
        .filter(Boolean) as AdminRow[];
      setAdmins(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    void supabase
      .from('roles')
      .select('id, name')
      .then(({ data }) => {
        setAdminRoleId(data?.find((r) => r.name === 'Admin')?.id ?? null);
      });
    void fetchAdmins();
  }, [isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter((a) => {
      if (statusFilter !== 'All' && (a.status || '') !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.full_name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q)
      );
    });
  }, [admins, search, statusFilter]);

  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Access denied"
        message="Only Super Admin can manage Admin accounts."
      />
    );
  }

  const openEdit = (admin: AdminRow) => {
    setEditing(admin);
    setEditForm({
      full_name: admin.full_name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      status: admin.status || 'Approved',
    });
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    const full_name = addForm.full_name.trim();
    const email = addForm.email.trim().toLowerCase();
    const phone = addForm.phone.trim();
    const password = addForm.password;

    if (!full_name || !email) {
      toastError('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError('Enter a valid email address.');
      return;
    }
    if (email === SUPER_ADMIN_EMAIL) {
      toastError('This email is reserved for Super Admin.');
      return;
    }
    if (password.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (password !== addForm.confirmPassword) {
      toastError('Password and Confirm Password do not match.');
      return;
    }
    if (!adminRoleId) {
      toastError('Admin role not found.');
      return;
    }

    setSaving(true);
    try {
      const ephemeral = createEphemeralAuthClient();
      const { data: authData, error: signUpError } = await ephemeral.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role: 'Admin',
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error(
          'Admin account was not created. Check email confirmation settings in Supabase Auth.',
        );
      }

      await new Promise((r) => setTimeout(r, 800));

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .limit(1);

      const profilePatch = {
        full_name,
        email,
        phone: phone || null,
        role_id: adminRoleId,
        status: 'Approved' as const,
        permissions: { ...ALL_PERMISSIONS_TRUE },
      };

      if (existingProfile?.[0]) {
        const { error } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('profiles').insert({ id: userId, ...profilePatch });
        if (error) throw new Error(error.message);
      }

      toastSuccess('Admin added.');
      setAddForm(emptyAdd);
      setShowAdd(false);
      await fetchAdmins();
    } catch (err: unknown) {
      toastError(err, 'Failed to create admin.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    const full_name = editForm.full_name.trim();
    const email = editForm.email.trim().toLowerCase();
    const phone = editForm.phone.trim();

    if (!full_name || !email) {
      toastError('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError('Enter a valid email address.');
      return;
    }
    if (email === SUPER_ADMIN_EMAIL) {
      toastError('This email is reserved for Super Admin.');
      return;
    }

    setSaving(true);
    const prevEmail = (editing.email || '').trim().toLowerCase();
    const emailChanged = email !== prevEmail;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name,
        email,
        phone: phone || null,
        status: editForm.status,
      })
      .eq('id', editing.id);

    if (error) {
      toastError(error, 'Something went wrong.');
      setSaving(false);
      return;
    }

    if (emailChanged) {
      try {
        await adminSetUserEmail(editing.id, email);
      } catch (err: unknown) {
        toastError(err, 'Email update failed.');
        setSaving(false);
        await fetchAdmins();
        return;
      }
    }

    toastSuccess('Admin updated.');
    setEditing(null);
    setSaving(false);
    await fetchAdmins();
  };

  const setStatus = async (admin: AdminRow, status: 'Approved' | 'Suspended' | 'Pending') => {
    if (admin.id === user?.id) {
      toastError("Can't change your own status.");
      return;
    }
    if (admin.status === status) return;
    const ok = await askConfirm({
      title: 'Change admin status?',
      description: `Are you sure you want to set "${admin.full_name || admin.email}" to ${status}?`,
      confirmLabel: `Yes, set ${status}`,
      cancelLabel: 'Cancel',
      tone: status === 'Approved' ? 'default' : 'warning',
    });
    if (!ok) return;

    const { error } = await supabase.from('profiles').update({ status }).eq('id', admin.id);
    if (error) {
      toastError(error, 'Something went wrong.');
      return;
    }
    toastSuccess(`Admin status set to ${status}.`);
    await fetchAdmins();
  };

  const removeAdmin = async (admin: AdminRow) => {
    if (admin.id === user?.id) {
      toastError("Can't remove your own account.");
      return;
    }
    const email = (admin.email || '').toLowerCase();
    const isPrimary = email === PRIMARY_ADMIN_EMAIL;
    const ok = await askConfirm({
      title: isPrimary ? 'Remove PRIMARY admin?' : 'Remove admin?',
      description: isPrimary
        ? `Are you sure you want to remove PRIMARY admin "${admin.full_name}" (${admin.email})?\n\nThis suspends the account. Auth login may still exist.`
        : `Are you sure you want to remove "${admin.full_name}"?\n\nThis suspends the account. Auth login may still exist.`,
      confirmLabel: 'Yes, remove admin',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'Suspended' })
      .eq('id', admin.id);

    if (error) {
      toastError(error, 'Something went wrong.');
      return;
    }
    toastSuccess('Admin removed.');
    await fetchAdmins();
  };

  const savePerms = async () => {
    if (!permsAdmin) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        permissions: perms,
        updated_at: new Date().toISOString(),
      })
      .eq('id', permsAdmin.id);
    if (error) {
      toastError(error, 'Something went wrong.');
    } else {
      toastSuccess('Permissions saved. That admin will be asked to login again.');
      setPermsAdmin(null);
      await fetchAdmins();
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetAdmin) return;
    if (newPassword.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await adminSetUserPassword(resetAdmin.id, newPassword);
      toastSuccess('Password updated.');
      setResetAdmin(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toastError(err, 'Password reset failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted/40 p-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Manage Admins</h1>
            <p className="text-muted-foreground mt-1">
              Add, edit email, reset password, change status, or remove Admin accounts.
            </p>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setAddForm(emptyAdd);
            setShowAdd(true);
          }}
        >
          <Plus className="w-4 h-4" /> Add Admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="All">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Admin</th>
                  <th className="px-4 py-3.5 font-semibold">Email</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Permissions</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No admins found
                    </td>
                  </tr>
                ) : (
                  filtered.map((admin) => {
                    const granted = countGranted(admin.permissions);
                    const isPrimary = (admin.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL;
                    return (
                      <tr key={admin.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {(admin.full_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold leading-tight">{admin.full_name || '—'}</p>
                              {isPrimary ? (
                                <p className="text-xs text-muted-foreground mt-0.5">Primary Admin</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p>{admin.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {admin.phone || 'No phone'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                              admin.status === 'Approved'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : admin.status === 'Suspended'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                          >
                            {admin.status === 'Approved' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {admin.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {granted}/{ADMIN_PERMISSION_KEYS.length} granted
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => openEdit(admin)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Permissions"
                              onClick={() => {
                                setPermsAdmin(admin);
                                setPerms(normalizePermissions(admin.permissions) as Record<string, boolean>);
                              }}
                            >
                              <Settings2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reset password"
                              onClick={() => {
                                setResetAdmin(admin);
                                setNewPassword('');
                                setConfirmPassword('');
                              }}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <select
                              className="h-8 max-w-[120px] rounded-md border bg-background px-2 text-xs"
                              value={admin.status || 'Pending'}
                              title="Change status"
                              onChange={(e) =>
                                setStatus(
                                  admin,
                                  e.target.value as 'Approved' | 'Pending' | 'Suspended',
                                )
                              }
                            >
                              <option value="Approved">Approved</option>
                              <option value="Pending">Pending</option>
                              <option value="Suspended">Suspended</option>
                            </select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Remove admin"
                              onClick={() => removeAdmin(admin)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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

      {/* Add Admin */}
      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add Admin</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <form className="space-y-4" onSubmit={handleAddAdmin}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={addForm.full_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Admin name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={addForm.phone}
                    onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={addForm.password}
                      onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm Password</label>
                    <Input
                      type="password"
                      value={addForm.confirmPassword}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))
                      }
                      placeholder="Re-enter password"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating…' : 'Create Admin'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Edit Admin */}
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Admin</h2>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email (login)</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Permissions */}
      {permsAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Permissions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {permsAdmin.full_name} · controls what this admin can access
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPermsAdmin(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPerms({ ...ALL_PERMISSIONS_TRUE })}
                >
                  Grant all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPerms(
                      Object.fromEntries(ADMIN_PERMISSION_KEYS.map((p) => [p.key, false])),
                    )
                  }
                >
                  Revoke all
                </Button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {ADMIN_PERMISSION_KEYS.map(({ key, label, hint }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!perms[key]}
                      onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPermsAdmin(null)}>
                  Cancel
                </Button>
                <Button onClick={savePerms} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Permissions'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Reset password */}
      {resetAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-none shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">{resetAdmin.full_name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setResetAdmin(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetAdmin(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleResetPassword} disabled={saving}>
                  {saving ? 'Saving…' : 'Reset Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

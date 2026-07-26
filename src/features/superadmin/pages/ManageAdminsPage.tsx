import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, CheckCircle, XCircle, Settings2, Key, Trash2 } from 'lucide-react';

type Admin = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  permissions: Record<string, boolean> | null;
};

const PERMISSION_KEYS: { key: string; label: string }[] = [
  { key: 'can_approve_users',    label: 'Approve / Reject Users' },
  { key: 'can_manage_teachers',  label: 'Manage Teachers' },
  { key: 'can_manage_students',  label: 'Manage Students' },
  { key: 'can_manage_courses',   label: 'Manage Courses & Batches' },
  { key: 'can_assign_teachers',  label: 'Assign Teachers to Courses' },
  { key: 'can_view_reports',     label: 'View Reports' },
  { key: 'can_export_pdf',       label: 'Export PDF Reports' },
  { key: 'can_reset_passwords',  label: 'Reset User Passwords' },
  { key: 'can_view_submissions', label: 'View All Submissions' },
];

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permissions Modal State
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  
  // Reset Password Modal State
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete Modal State
  const [deleteAdmin, setDeleteAdmin] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, status, permissions, roles!inner(name)')
      .eq('roles.name', 'Admin')
      .order('full_name');

    if (data) setAdmins(data as Admin[]);
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const openPerms = (admin: Admin) => {
    setSelectedAdmin(admin);
    setPerms(admin.permissions ?? {});
  };

  const savePerms = async () => {
    if (!selectedAdmin) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ permissions: perms })
      .eq('id', selectedAdmin.id);

    if (!error) {
      setToast(`✅ Permissions saved for ${selectedAdmin.full_name}`);
      setAdmins(prev => prev.map(a => a.id === selectedAdmin.id ? { ...a, permissions: perms } : a));
      setSelectedAdmin(null);
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordAdmin || newPassword.length < 6) return;
    setResetting(true);
    
    const { error } = await supabase.rpc('update_user_password', {
      user_id: resetPasswordAdmin.id,
      new_password: newPassword
    });

    if (!error) {
      setToast(`✅ Password reset successfully for ${resetPasswordAdmin.full_name}`);
      setResetPasswordAdmin(null);
      setNewPassword('');
      setTimeout(() => setToast(''), 3000);
    } else {
      alert(`Error resetting password: ${error.message}`);
    }
    setResetting(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteAdmin) return;
    setDeleting(true);
    
    const { error } = await supabase.rpc('delete_user', {
      user_id: deleteAdmin.id
    });

    if (!error) {
      setToast(`🗑️ ${deleteAdmin.full_name} has been deleted permanently.`);
      setAdmins(prev => prev.filter(a => a.id !== deleteAdmin.id));
      setDeleteAdmin(null);
      setTimeout(() => setToast(''), 3000);
    } else {
      alert(`Error deleting user: ${error.message}`);
    }
    setDeleting(false);
  };

  const toggleStatus = async (admin: Admin) => {
    const newStatus = admin.status === 'Approved' ? 'Suspended' : 'Approved';
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', admin.id);

    if (!error) {
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, status: newStatus } : a));
      setToast(`✅ ${admin.full_name} is now ${newStatus}`);
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
          <Shield className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Manage Admins</h1>
          <p className="text-muted-foreground text-sm">Control admin accounts, permissions, and security</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
      ) : admins.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No admins found</p>
            <p className="text-sm mt-1">Approve an admin from the Pending Approvals page to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold">Admin</th>
                    <th className="text-left px-6 py-4 font-semibold">Email</th>
                    <th className="text-left px-6 py-4 font-semibold">Status</th>
                    <th className="text-left px-6 py-4 font-semibold">Permissions</th>
                    <th className="text-left px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {admins.map((admin) => {
                    const grantedCount = Object.values(admin.permissions ?? {}).filter(Boolean).length;
                    return (
                      <tr key={admin.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {admin.full_name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <span className="font-medium">{admin.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{admin.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            admin.status === 'Approved'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {admin.status === 'Approved' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {admin.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-muted-foreground text-xs">{grantedCount}/{PERMISSION_KEYS.length} granted</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openPerms(admin)} className="gap-1.5" title="Edit Permissions">
                              <Settings2 size={14} /> <span className="hidden xl:inline">Permissions</span>
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setResetPasswordAdmin(admin)} className="gap-1.5" title="Reset Password">
                              <Key size={14} /> <span className="hidden xl:inline">Reset</span>
                            </Button>
                            <Button
                              size="sm"
                              variant={admin.status === 'Approved' ? 'secondary' : 'default'}
                              onClick={() => toggleStatus(admin)}
                              className="w-[85px]"
                            >
                              {admin.status === 'Approved' ? 'Suspend' : 'Activate'}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleteAdmin(admin)} className="gap-1.5" title="Delete Admin">
                              <Trash2 size={14} /> <span className="hidden xl:inline">Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Modal */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Edit Permissions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Setting permissions for <strong>{selectedAdmin.full_name}</strong>
              </p>
            </div>
            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {PERMISSION_KEYS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={!!perms[key]}
                    onChange={(e) => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
            <div className="p-6 border-t flex gap-3">
              <Button onClick={savePerms} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Permissions'}
              </Button>
              <Button variant="outline" onClick={() => setSelectedAdmin(null)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Setting a new password for <strong>{resetPasswordAdmin.full_name}</strong>
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input 
                  type="password" 
                  placeholder="Min 6 characters" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6} className="flex-1">
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </Button>
              <Button variant="outline" onClick={() => {
                setResetPasswordAdmin(null);
                setNewPassword('');
              }} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Modal */}
      {deleteAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
                <Trash2 size={24} /> Delete Admin?
              </h2>
            </div>
            <div className="p-6">
              <p className="text-foreground">
                Are you absolutely sure you want to permanently delete <strong>{deleteAdmin.full_name}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone. It will remove their profile and all associated access instantly.
              </p>
            </div>
            <div className="p-6 border-t flex gap-3">
              <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting} className="flex-1">
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteAdmin(null)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Shield, Users, Settings, KeyRound, ShieldCheck, GraduationCap, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function SuperAdminDashboard() {
  const { user } = useAuthStore();
  const [profileName, setProfileName] = useState('');
  const [roleCount, setRoleCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      void supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]?.full_name) setProfileName(data[0].full_name);
        });
    }

    void (async () => {
      const { data: roles } = await supabase.from('roles').select('id, name');
      setRoleCount(roles?.length ?? 0);
      const adminRoleId = roles?.find((r) => r.name === 'Admin')?.id;
      if (adminRoleId) {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', adminRoleId);
        setAdminCount(count ?? 0);
      }
    })();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Super Admin
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome{profileName ? `, ${profileName}` : ''}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Platform control panel — manage system roles and account settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{roleCount}</p>
            <p className="text-xs text-muted-foreground">Defined in the LMS</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{adminCount}</p>
            <p className="text-xs text-muted-foreground">Operational Admin accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Super Admin</p>
            <p className="text-xs text-muted-foreground">Full platform access</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Manage Admins</h2>
            <p className="text-sm text-muted-foreground">
              Add admins, change email/password, set status, permissions, or remove accounts.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/admins" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Open Admins
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Staff Pay</h2>
            <p className="text-sm text-muted-foreground">
              Monthly pay for teachers, admins, cleaners and other staff — paid or pending.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/staff-pay" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Open Staff Pay
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Roles</h2>
            <p className="text-sm text-muted-foreground">
              View every role configured in the system (Super Admin, Admin, Teacher, Student).
            </p>
            <Button asChild className="w-fit" variant="outline">
              <Link to="/dashboard/roles">Open Roles</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Manage Teachers</h2>
            <p className="text-sm text-muted-foreground">
              View all teachers, edit username/email, change status, or delete accounts.
            </p>
            <Button asChild className="w-fit">
              <Link to="/dashboard/teachers" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Open Teachers
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Teacher Approvals</h2>
            <p className="text-sm text-muted-foreground">
              Only Super Admin can approve/reject/suspend teacher accounts.
            </p>
            <Button asChild className="w-fit" variant="outline">
              <Link to="/dashboard/approvals" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Review Pending Approvals
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Update your Super Admin profile and password.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Open Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

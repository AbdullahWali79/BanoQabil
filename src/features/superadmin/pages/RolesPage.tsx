import { useEffect, useState } from 'react';
import { KeyRound, Shield, Users, GraduationCap, UserCog } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

type RoleRow = {
  id: string;
  name: string;
  userCount: number;
};

const ROLE_META: Record<
  string,
  { description: string; icon: typeof Shield }
> = {
  'Super Admin': {
    description: 'Platform owner — roles and system settings.',
    icon: Shield,
  },
  Admin: {
    description: 'Day-to-day LMS admin — teachers, students, courses, reports.',
    icon: UserCog,
  },
  Teacher: {
    description: 'Creates assignments, marks attendance, grades submissions.',
    icon: Users,
  },
  Student: {
    description: 'Enrolled learner — assignments, attendance, grades.',
    icon: GraduationCap,
  },
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      const { data, error: rolesError } = await supabase
        .from('roles')
        .select('id, name')
        .order('name');

      if (rolesError) {
        setError(rolesError.message);
        setRoles([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as { id: string; name: string }[];
      const withCounts = await Promise.all(
        rows.map(async (role) => {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role_id', role.id);
          return {
            id: role.id,
            name: role.name,
            userCount: count ?? 0,
          };
        }),
      );

      // Prefer known order: Super Admin, Admin, Teacher, Student, then others
      const order = ['Super Admin', 'Admin', 'Teacher', 'Student'];
      withCounts.sort((a, b) => {
        const ai = order.indexOf(a.name);
        const bi = order.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      setRoles(withCounts);
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Super Admin
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Roles</h1>
        <p className="mt-1 text-muted-foreground">
          All roles defined in the system and how many users are assigned to each.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading roles…</p>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No roles found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {roles.map((role) => {
            const meta = ROLE_META[role.name];
            const Icon = meta?.icon ?? KeyRound;
            return (
              <Card key={role.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {meta?.description ?? 'Custom system role.'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{role.userCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {role.userCount === 1 ? 'user assigned' : 'users assigned'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

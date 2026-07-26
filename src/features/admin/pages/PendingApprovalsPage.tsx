import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { UserCheck, UserX, ShieldCheck, Mail, Calendar } from 'lucide-react';

type PendingUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
};

export function PendingApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingUsers = async () => {
    setIsLoading(true);
    // Join with roles table to get role name
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        created_at,
        roles!inner(name)
      `)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Map data to our type
      const mappedData = data.map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        email: d.email,
        role: d.roles.name,
        created_at: new Date(d.created_at).toLocaleDateString(),
      }));
      setUsers(mappedData);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleAction = async (userId: string, status: 'Approved' | 'Rejected') => {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (!error) {
      setUsers(users.filter(u => u.id !== userId));
    } else {
      alert("Error updating user status");
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve or reject new account registrations.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No pending approvals</h3>
          <p>All caught up! There are no new registrations waiting for review.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div key={user.id} className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    user.role === 'Teacher' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {user.role}
                  </span>
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Calendar size={12} className="mr-1" />
                    {user.created_at}
                  </span>
                </div>
                
                <h3 className="text-xl font-semibold mb-1 truncate" title={user.full_name}>
                  {user.full_name}
                </h3>
                
                <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span className="truncate" title={user.email}>{user.email}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 border-t flex gap-3">
                <Button 
                  onClick={() => handleAction(user.id, 'Approved')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <UserCheck size={16} className="mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleAction(user.id, 'Rejected')}
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <UserX size={16} className="mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

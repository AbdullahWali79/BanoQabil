import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router';

export function PendingApprovalPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 bg-card text-card-foreground rounded-xl shadow-lg border text-center space-y-6">
        <h1 className="text-3xl font-bold text-yellow-600">Approval Pending</h1>
        <p className="text-muted-foreground">
          Your account is currently under review by an administrator. You will gain access to your dashboard once your account is approved.
        </p>
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

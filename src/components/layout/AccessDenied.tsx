import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router';

type AccessDeniedProps = {
  title?: string;
  message?: string;
};

/** Inline access-denied block for pages that gate by role internally. */
export function AccessDenied({
  title = 'Access denied',
  message = 'You do not have permission to open this page.',
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
        <ShieldOff className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  );
}

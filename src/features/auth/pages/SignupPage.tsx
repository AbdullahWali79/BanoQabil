import { BrandLogo } from '@/components/BrandLogo';
import { SignupForm } from '../components/SignupForm';

export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            imgClassName="h-14"
            textClassName="text-3xl font-extrabold text-primary"
          />
          <p className="text-muted-foreground mt-2">Join the Educational Institute</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}

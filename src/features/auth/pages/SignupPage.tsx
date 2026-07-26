import { SignupForm } from '../components/SignupForm';

export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary tracking-tight">BanoQabil</h1>
          <p className="text-muted-foreground mt-2">Join the Educational Institute</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}

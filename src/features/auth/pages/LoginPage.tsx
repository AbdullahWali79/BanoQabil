import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary tracking-tight">BanoQabil</h1>
          <p className="text-muted-foreground mt-2">Educational Institute Management</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

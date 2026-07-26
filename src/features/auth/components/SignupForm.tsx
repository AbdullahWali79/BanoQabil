import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const signupSchema = z.object({
  fullName: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  role: z.enum(['Admin', 'Teacher', 'Student']),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [rolesMap, setRolesMap] = useState<Record<string, string>>({});

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'Student',
    },
  });

  // Fetch role IDs to assign the correct role during signup
  useEffect(() => {
    supabase.from('roles').select('id, name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r) => { map[r.name] = r.id; });
        setRolesMap(map);
      }
    });
  }, []);

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true);
    setError(null);
    
    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          // Custom meta data to trigger our webhook/function or use in UI
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Update their profile with the selected role and set status to Pending
      const roleId = rolesMap[data.role];
      if (roleId) {
         await supabase.from('profiles').update({
           role_id: roleId,
           status: 'Pending' // Requires this column in DB
         }).eq('id', authData.user.id);
      }
      
      setSuccess(true);
    }
    setIsLoading(false);
  }

  if (success) {
    return (
      <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border text-center">
        <h2 className="text-2xl font-bold text-green-600">Registration Successful!</h2>
        <p className="text-muted-foreground">
          Your account has been created and is currently <strong className="text-foreground">Pending Approval</strong> by an Admin.
          You will be able to log in to your portal once approved.
        </p>
        <Button asChild className="mt-4 w-full"><Link to="/login">Go to Login</Link></Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Create an Account</h1>
        <p className="text-sm text-muted-foreground mt-2">Join as a Teacher or Student</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="••••••••" type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Register As</FormLabel>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="Student" 
                      checked={field.value === 'Student'}
                      onChange={field.onChange}
                      className="w-4 h-4 text-primary"
                    />
                    <span>Student</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="Teacher" 
                      checked={field.value === 'Teacher'}
                      onChange={field.onChange}
                      className="w-4 h-4 text-primary"
                    />
                    <span>Teacher</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      value="Admin" 
                      checked={field.value === 'Admin'}
                      onChange={field.onChange}
                      className="w-4 h-4 text-primary"
                    />
                    <span>Admin</span>
                  </label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive text-center font-medium">{error}</p>}
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>
      </Form>
      <div className="text-center text-sm text-muted-foreground">
        Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
      </div>
    </div>
  );
}

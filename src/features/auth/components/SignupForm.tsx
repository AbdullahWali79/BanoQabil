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
import { ensureStudentRow } from '@/features/teacher/utils/teacherData';
import { generateUniqueApplicationId } from '@/lib/applicationId';

const signupSchema = z.object({
  fullName: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  courseId: z.string().min(1, { message: 'Please select a course' }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

type CourseOption = { id: string; name: string };

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [studentRoleId, setStudentRoleId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      courseId: '',
    },
  });

  useEffect(() => {
    Promise.all([
      supabase.from('roles').select('id, name'),
      supabase.from('courses').select('id, name').order('name'),
    ]).then(([rolesRes, coursesRes]) => {
      const studentRole = rolesRes.data?.find((r) => r.name === 'Student');
      setStudentRoleId(studentRole?.id ?? null);
      setCourses((coursesRes.data as CourseOption[]) ?? []);
    });
  }, []);

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true);
    setError(null);

    if (!studentRoleId) {
      setError('Student role is not configured. Please contact admin.');
      setIsLoading(false);
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: 'Student',
          course_id: data.courseId,
        },
      },
    });

    if (signUpError) {
      const rawMessage = signUpError.message || 'Signup failed';
      if (
        rawMessage.toLowerCase().includes('over_email_send_rate_limit') ||
        rawMessage.toLowerCase().includes('email rate limit exceeded')
      ) {
        setError('Too many signup attempts. Please wait a few minutes and try again.');
      } else {
        setError(rawMessage);
      }
      setIsLoading(false);
      return;
    }

    if (authData.user) {
      await new Promise((r) => setTimeout(r, 600));

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          email: data.email,
          role_id: studentRoleId,
          status: 'Pending',
        })
        .eq('id', authData.user.id);

      if (profileError) {
        // Profile may not exist yet — insert
        await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          role_id: studentRoleId,
          status: 'Pending',
        });
      }

      try {
        const appId = await generateUniqueApplicationId();
        await ensureStudentRow(authData.user.id, {
          course_id: data.courseId,
          application_id: appId,
        });
        setApplicationId(appId);
      } catch (err: any) {
        // Non-fatal for signup success UI; admin can sync later
        console.warn('Student row create:', err?.message);
      }

      setSuccess(true);
    }
    setIsLoading(false);
  }

  if (success) {
    return (
      <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border text-center">
        <h2 className="text-2xl font-bold text-green-600">Application Submitted!</h2>
        <p className="text-muted-foreground">
          Your student account is <strong className="text-foreground">Pending Approval</strong>.
          You will be able to log in once an admin approves your application.
        </p>
        {applicationId ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Your Application ID:{' '}
            <span className="font-mono font-semibold text-foreground">{applicationId}</span>
          </p>
        ) : null}
        <Button asChild className="mt-4 w-full">
          <Link to="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card text-card-foreground rounded-xl shadow-lg border">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Student Application</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Apply as a student and select your preferred course
        </p>
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
                  <Input placeholder="Your full name" {...field} />
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
                  <Input placeholder="you@example.com" type="email" {...field} />
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
            name="courseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Course <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <p className="text-sm text-destructive text-center font-medium">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || courses.length === 0}>
            {isLoading ? 'Submitting...' : 'Apply as Student'}
          </Button>
        </form>
      </Form>
      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

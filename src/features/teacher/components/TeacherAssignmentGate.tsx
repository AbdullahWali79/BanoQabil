import { Link } from 'react-router';
import { BookOpen, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { GenderScope } from '@/features/teacher/utils/teacherData';

type Props = {
  courseName?: string | null;
  genderScope?: GenderScope | null;
  /** While true, show loader instead of the “no course” banner. */
  loading?: boolean;
  /** If true and blocked, still render children underneath a banner. Default: block children. */
  soft?: boolean;
  children?: React.ReactNode;
};

/**
 * Blocks teacher class tools when:
 * - no course assigned, OR
 * - course assigned but Male/Female/Both not chosen
 */
export function TeacherAssignmentGate({
  courseName,
  genderScope,
  loading,
  soft,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const noCourse = !courseName;
  const noGender = !!courseName && !genderScope;

  if (!noCourse && !noGender) {
    return <>{children}</>;
  }

  const banner = (
    <Card className="border-amber-300/60 bg-amber-50/80">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          {noCourse ? <BookOpen className="h-6 w-6" /> : <Users className="h-6 w-6" />}
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-amber-950">
            {noCourse ? 'No course assigned' : 'Class gender not set'}
          </h2>
          <p className="text-sm text-amber-900/80">
            {noCourse
              ? 'Admin has not assigned any course to you yet. You will not see students, attendance, or class tools until a course is assigned.'
              : `Your course is "${courseName}", but admin has not selected Only Male / Only Female / Both. No students will show until that is set.`}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-amber-300 bg-white">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );

  if (soft) {
    return (
      <div className="space-y-6">
        {banner}
        {children}
      </div>
    );
  }

  return <div>{banner}</div>;
}

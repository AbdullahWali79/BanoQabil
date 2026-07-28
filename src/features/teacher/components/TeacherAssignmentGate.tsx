import { Link } from 'react-router';
import { BookOpen, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { GenderScope } from '@/features/teacher/utils/teacherData';

type Props = {
  courseName?: string | null;
  genderScope?: GenderScope | null;
  /** If true and blocked, still render children underneath a banner. Default: block children. */
  soft?: boolean;
  children?: React.ReactNode;
};

/**
 * Blocks teacher class tools when:
 * - no course assigned, OR
 * - course assigned but Male/Female/Both not chosen
 */
export function TeacherAssignmentGate({ courseName, genderScope, soft, children }: Props) {
  const noCourse = !courseName;
  const noGender = !!courseName && !genderScope;

  if (!noCourse && !noGender) {
    return <>{children}</>;
  }

  const banner = (
    <Card className="border-amber-300/60 bg-amber-50/80">
      <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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
              : `Your course is “${courseName}”, but admin has not selected Only Male / Only Female / Both. No students will show until that is set.`}
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

  return <div className="p-6 sm:p-8">{banner}</div>;
}

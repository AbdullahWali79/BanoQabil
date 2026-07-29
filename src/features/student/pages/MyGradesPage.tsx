import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Award, TrendingUp } from 'lucide-react';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { getStudentContext } from '@/features/student/utils/studentData';

type GradeRow = {
  id: string;
  marks: number | null;
  remarks: string | null;
  graded_at: string | null;
  status: string | null;
  assignments?:
    | { title: string; due_date: string }
    | { title: string; due_date: string }[]
    | null;
};

function marksTone(marks: number) {
  if (marks >= 80) return 'text-emerald-700';
  if (marks >= 50) return 'text-amber-700';
  return 'text-red-700';
}

export default function MyGradesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadGrades() {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage('');

      const ctx = await getStudentContext(user.id);

      if (!ctx?.studentId) {
        setErrorMessage('Student profile not found. Please contact admin.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('submissions')
        .select('id, marks, remarks, graded_at, status, assignments(title, due_date)')
        .eq('student_id', ctx.studentId)
        .not('marks', 'is', null)
        .order('graded_at', { ascending: false });

      if (error) {
        setErrorMessage(`Unable to fetch grades: ${error.message}`);
      } else {
        setGrades((data ?? []) as GradeRow[]);
      }

      setLoading(false);
    }

    void loadGrades();
  }, [user?.id]);

  const average = useMemo(() => {
    if (!grades.length) return null;
    const valid = grades.map((g) => g.marks ?? 0);
    return Math.round(valid.reduce((sum, m) => sum + m, 0) / valid.length);
  }, [grades]);

  const highest = useMemo(() => {
    if (!grades.length) return null;
    return Math.max(...grades.map((g) => g.marks ?? 0));
  }, [grades]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
        <p className="mt-1 text-muted-foreground">
          Marks given by your course teacher for each assignment (out of 100).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Marks</p>
              <p className="text-2xl font-bold">{average != null ? `${average} / 100` : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Highest Marks</p>
              <p className="text-2xl font-bold">{highest != null ? `${highest} / 100` : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-semibold">SR#</th>
                  <th className="px-6 py-3 font-semibold">Assignment</th>
                  <th className="px-6 py-3 font-semibold">Graded On</th>
                  <th className="px-6 py-3 font-semibold">Marks</th>
                  <th className="px-6 py-3 font-semibold">Teacher Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      Loading grades...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-destructive">
                      {errorMessage}
                    </td>
                  </tr>
                ) : grades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      No graded assignments yet. Submit work from{' '}
                      <Link to="/dashboard/my-assignments" className="text-primary hover:underline">
                        Assignments
                      </Link>
                      , then wait for your teacher to mark it.
                    </td>
                  </tr>
                ) : (
                  grades.map((row, index) => {
                    const assignment = relationOne(row.assignments);
                    const marks = row.marks ?? 0;
                    return (
                      <tr key={row.id} className="border-b">
                        <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                        <td className="px-6 py-4 font-medium">{assignment?.title || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {row.graded_at
                            ? new Date(row.graded_at).toLocaleString()
                            : assignment?.due_date
                              ? new Date(assignment.due_date).toLocaleDateString()
                              : '—'}
                        </td>
                        <td className={`px-6 py-4 text-base font-bold ${marksTone(marks)}`}>
                          {marks} / 100
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {row.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

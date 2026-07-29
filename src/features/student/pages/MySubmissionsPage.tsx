import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Upload } from 'lucide-react';
import { relationOne } from '@/features/teacher/utils/teacherData';
import { getStudentContext } from '@/features/student/utils/studentData';

type SubmissionRecord = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  marks: number | null;
  remarks: string | null;
  youtube_url: string | null;
  drive_url: string | null;
  assignments?:
    | { title: string; due_date: string }
    | { title: string; due_date: string }[]
    | null;
};

export default function MySubmissionsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function fetchSubmissions() {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage('');

      const ctx = await getStudentContext(user.id);

      if (!ctx?.studentId) {
        setErrorMessage('Student profile not found. Please contact admin to complete your setup.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('submissions')
        .select(
          'id, status, submitted_at, marks, remarks, youtube_url, drive_url, assignments(title, due_date)',
        )
        .eq('student_id', ctx.studentId)
        .order('submitted_at', { ascending: false });

      if (error) {
        setErrorMessage(`Unable to load submissions: ${error.message}`);
      } else {
        setSubmissions((data ?? []) as SubmissionRecord[]);
      }

      setLoading(false);
    }

    fetchSubmissions();
  }, [user?.id]);

  const filtered = useMemo(
    () =>
      submissions.filter((item) => {
        const assignment = relationOne(item.assignments);
        return (assignment?.title ?? '').toLowerCase().includes(search.toLowerCase());
      }),
    [search, submissions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Submissions</h1>
        <p className="mt-1 text-muted-foreground">
          History of work you sent to your teacher â€” including marks once graded.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by assignment title..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">SR#</th>
                  <th className="px-6 py-3 font-semibold">Assignment</th>
                  <th className="px-6 py-3 font-semibold">Submitted At</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Marks</th>
                  <th className="px-6 py-3 font-semibold">Remarks</th>
                  <th className="px-6 py-3 font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                      Loading submissions...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-destructive">
                      {errorMessage}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                      <Upload className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No submissions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => {
                    const assignment = relationOne(item.assignments);
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                        <td className="px-6 py-4 font-medium">{assignment?.title || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {item.submitted_at
                            ? new Date(item.submitted_at).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                            {item.status || 'Submitted'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold">
                          {item.marks != null ? `${item.marks} / 100` : 'Awaiting marks'}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{item.remarks || 'â€”'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {item.youtube_url && (
                              <a
                                href={item.youtube_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                YouTube
                              </a>
                            )}
                            {item.drive_url && (
                              <a
                                href={item.drive_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                Drive
                              </a>
                            )}
                            {!item.youtube_url && !item.drive_url && (
                              <span className="text-muted-foreground">No links</span>
                            )}
                          </div>
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

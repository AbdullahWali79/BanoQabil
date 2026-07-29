import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileText } from 'lucide-react';
import { relationOne } from '@/features/teacher/utils/teacherData';

type SubmissionRow = {
  id: string;
  status: string | null;
  marks: number | null;
  submitted_at: string | null;
  youtube_url: string | null;
  drive_url: string | null;
  assignments?: { title?: string } | { title?: string }[] | null;
  students?: {
    profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
  } | {
    profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
  }[] | null;
};

export default function AllSubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage('');
      const { data, error } = await supabase
        .from('submissions')
        .select(
          `
          id,
          status,
          marks,
          submitted_at,
          youtube_url,
          drive_url,
          assignments(title),
          students(profiles(full_name, email))
        `,
        )
        .order('submitted_at', { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as SubmissionRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const assignment = relationOne(row.assignments);
      const student = relationOne(row.students);
      const profile = relationOne(student?.profiles);
      const status = row.marks != null ? 'Graded' : row.status || 'Pending';

      if (statusFilter !== 'All') {
        if (statusFilter === 'Graded' && row.marks == null) return false;
        if (statusFilter === 'Pending' && row.marks != null) return false;
        if (statusFilter === 'Late' && status.toLowerCase() !== 'late') return false;
      }

      return (
        assignment?.title?.toLowerCase().includes(q) ||
        profile?.full_name?.toLowerCase().includes(q) ||
        profile?.email?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Submissions</h1>
        <p className="text-muted-foreground mt-1">Overview of all student assignment submissions</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap gap-4 items-center">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student or title..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md text-sm bg-transparent h-10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>Pending</option>
              <option>Graded</option>
              <option>Late</option>
            </select>
          </div>

          {errorMessage && (
            <div className="px-4 py-3 text-sm text-destructive border-b">{errorMessage}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/40 border-b">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Assignment</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Marks</th>
                  <th className="px-6 py-3">Links</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      No submissions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const assignment = relationOne(row.assignments);
                    const student = relationOne(row.students);
                    const profile = relationOne(student?.profiles);
                    const status = row.marks != null ? 'Graded' : row.status || 'Submitted';
                    return (
                      <tr key={row.id} className="border-b">
                        <td className="px-6 py-4">
                          <div className="font-medium">{profile?.full_name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{profile?.email}</div>
                        </td>
                        <td className="px-6 py-4">{assignment?.title || '-'}</td>
                        <td className="px-6 py-4">
                          {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4">{status}</td>
                        <td className="px-6 py-4">{row.marks ?? '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {row.youtube_url && (
                              <a href={row.youtube_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                YouTube
                              </a>
                            )}
                            {row.drive_url && (
                              <a href={row.drive_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                Drive
                              </a>
                            )}
                            {!row.youtube_url && !row.drive_url && '-'}
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

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FolderOpen } from 'lucide-react';
import { relationOne } from '@/features/teacher/utils/teacherData';

type AssignmentRow = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  created_at: string;
  batches?: { name?: string } | { name?: string }[] | null;
  profiles?: { full_name?: string } | { full_name?: string }[] | null;
};

export default function AllAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage('');

      // teacher_id may point to teachers.id OR profiles.id — try teachers join first, then profiles
      const primary = await supabase
        .from('assignments')
        .select('id, title, due_date, status, created_at, batches(name), teachers(profiles(full_name))')
        .order('created_at', { ascending: false });

      if (!primary.error) {
        setRows(
          (primary.data ?? []).map((row: any) => {
            const teacher = relationOne(row.teachers);
            const profile = relationOne(teacher?.profiles);
            return {
              ...row,
              profiles: profile ? { full_name: profile.full_name } : null,
            };
          }),
        );
        setLoading(false);
        return;
      }

      const fallback = await supabase
        .from('assignments')
        .select('id, title, due_date, status, created_at, batches(name)')
        .order('created_at', { ascending: false });

      if (fallback.error) {
        setErrorMessage(fallback.error.message);
        setRows([]);
      } else {
        setRows((fallback.data ?? []) as AssignmentRow[]);
      }
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const batch = relationOne(row.batches);
      const teacher = relationOne(row.profiles);
      return (
        row.title?.toLowerCase().includes(q) ||
        batch?.name?.toLowerCase().includes(q) ||
        teacher?.full_name?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Assignments</h1>
        <p className="text-muted-foreground mt-1">Monitor all assignments across batches</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap gap-4 items-center">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="px-4 py-3 text-sm text-destructive border-b">{errorMessage}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/40 border-b">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Batch</th>
                  <th className="px-6 py-3">Teacher</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      No assignments found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const batch = relationOne(row.batches);
                    const teacher = relationOne(row.profiles);
                    return (
                      <tr key={row.id} className="border-b">
                        <td className="px-6 py-4 font-medium">{row.title}</td>
                        <td className="px-6 py-4">{batch?.name || '-'}</td>
                        <td className="px-6 py-4">{teacher?.full_name || '-'}</td>
                        <td className="px-6 py-4">
                          {row.due_date ? new Date(row.due_date).toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4">{row.status}</td>
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

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';
import { getTeacherStudents, relationOne } from '@/features/teacher/utils/teacherData';

type Student = {
  id: string;
  application_id: string | null;
  batch_id?: string | null;
  course_id?: string | null;
  batches?: { id: string; name?: string | null } | { id: string; name?: string | null }[] | null;
  courses?: { id: string; name?: string | null } | { id: string; name?: string | null }[] | null;
  profiles?:
    | { full_name?: string | null; email?: string | null; phone?: string | null; status?: string | null }
    | { full_name?: string | null; email?: string | null; phone?: string | null; status?: string | null }[]
    | null;
};

function cleanBatch(name?: string | null) {
  return (name || '').replace(/^tid:[a-f0-9-]+\|/i, '') || 'â€”';
}

export default function TeacherStudentsPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      setError('');
      try {
        const data = await getTeacherStudents<Student>(user.id);
        setStudents(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load students');
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  const filtered = students.filter((s) => {
    const p = relationOne(s.profiles);
    const q = search.toLowerCase();
    return (
      (p?.full_name || '').toLowerCase().includes(q) ||
      (p?.email || '').toLowerCase().includes(q) ||
      (s.application_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">
          Students in your assigned class/course only (not mixed with other teachers).
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">App ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No students in your class yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const p = relationOne(s.profiles);
                    const batch = relationOne(s.batches);
                    const course = relationOne(s.courses);
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="px-4 py-3 font-mono text-xs">{s.application_id || 'â€”'}</td>
                        <td className="px-4 py-3 font-medium">{p?.full_name || 'â€”'}</td>
                        <td className="px-4 py-3">{p?.email || 'â€”'}</td>
                        <td className="px-4 py-3">{p?.phone || 'â€”'}</td>
                        <td className="px-4 py-3 text-xs">{course?.name || 'â€”'}</td>
                        <td className="px-4 py-3 text-xs">{cleanBatch(batch?.name)}</td>
                        <td className="px-4 py-3 text-xs">{p?.status || 'â€”'}</td>
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

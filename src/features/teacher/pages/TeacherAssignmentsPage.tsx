import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import {
  cleanBatchDisplayName,
  getTeacherAssignedCourse,
  getTeacherBatches,
  getTeacherEntityId,
  relationOne,
  type BatchRow,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  batch_id: string;
  batches?: { name?: string } | { name?: string }[] | null;
};

export default function TeacherAssignmentsPage() {
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [batches, setBatches] = useState<(BatchRow & { display_name: string })[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    batch_id: '',
    status: 'Open',
  });
  const [courseName, setCourseName] = useState<string | null>(null);
  const [genderScope, setGenderScope] = useState<GenderScope | null>(null);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMessage('');

    const assigned = await getTeacherAssignedCourse(user.id);
    setCourseName(assigned?.name ?? null);
    setGenderScope(assigned?.genderScope ?? null);

    const entityId = await getTeacherEntityId(user.id);
    setTeacherId(entityId);
    const teacherKeys = [user.id, entityId].filter(Boolean) as string[];

    const teacherBatches = await getTeacherBatches(user.id);
    setBatches(teacherBatches);
    const batchIds = teacherBatches.map((b) => b.id);

    let query = supabase
      .from('assignments')
      .select('id, title, description, due_date, status, batch_id, batches(name)')
      .order('created_at', { ascending: false });

    if (teacherKeys.length > 0) {
      query = query.in('teacher_id', teacherKeys);
    } else {
      query = query.eq('teacher_id', user.id);
    }

    let { data, error } = await query;

    // Fallback: assignments for teacher's batches (older rows / id mismatch)
    if ((!data || data.length === 0) && batchIds.length > 0) {
      const byBatch = await supabase
        .from('assignments')
        .select('id, title, description, due_date, status, batch_id, batches(name)')
        .in('batch_id', batchIds)
        .order('created_at', { ascending: false });
      data = byBatch.data;
      error = byBatch.error;
    }

    if (error) {
      setErrorMessage(error.message);
      setAssignments([]);
    } else {
      setAssignments((data ?? []) as AssignmentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !form.title.trim() || !form.batch_id || !form.due_date) {
      setErrorMessage('Title, batch and due date are required.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const { error } = await supabase.from('assignments').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: new Date(form.due_date).toISOString(),
      batch_id: form.batch_id,
      status: form.status,
      // Prefer teachers.id when available; also works if schema uses profile id
      teacher_id: teacherId || user.id,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setForm({ title: '', description: '', due_date: '', batch_id: '', status: 'Open' });
    setShowForm(false);
    setSaving(false);
    await loadData();
  };

  const toggleStatus = async (assignment: AssignmentRow) => {
    const next = assignment.status === 'Open' ? 'Closed' : 'Open';
    const { error } = await supabase
      .from('assignments')
      .update({ status: next })
      .eq('id', assignment.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignment.id ? { ...a, status: next } : a)),
    );
  };

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope}>
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create work for your class. Students submit to you; only you can give marks.
          </p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Create Assignment'}
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Batch</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.batch_id}
                    onChange={(e) => setForm((f) => ({ ...f, batch_id: e.target.value }))}
                    required
                  >
                    <option value="">Select batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.display_name}
                      </option>
                    ))}
                  </select>
                  {batches.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No batches assigned to you yet. Ask admin to assign a batch.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Due date</label>
                  <Input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || batches.length === 0}>
                  {saving ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-4">SR#</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Deadline</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No assignments found
                  </td>
                </tr>
              ) : (
                assignments.map((a, index) => {
                  const batch = relationOne(a.batches);
                  return (
                    <tr key={a.id} className="border-b">
                      <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                      <td className="px-6 py-4 font-medium">{a.title}</td>
                      <td className="px-6 py-4">{cleanBatchDisplayName(batch?.name) || '-'}</td>
                      <td className="px-6 py-4">
                        {a.due_date ? new Date(a.due_date).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4">{a.status}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/dashboard/assignments/${a.id}/grade`}>
                              Grade Submissions
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleStatus(a)}>
                            Mark {a.status === 'Open' ? 'Closed' : 'Open'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
    </TeacherAssignmentGate>
  );
}

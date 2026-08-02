import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getTeacherBatches,
  getTeacherEntityId,
  relationOne,
} from '@/features/teacher/utils/teacherData';

type GradeDraft = {
  id: string;
  studentName: string;
  studentEmail: string;
  applicationId: string;
  submitted_at: string | null;
  youtube_url: string | null;
  drive_url: string | null;
  status: string | null;
  marks: string;
  remarks: string;
};

export default function GradeSubmissionsPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('Grade Submissions');
  const [batchLabel, setBatchLabel] = useState('');
  const [rows, setRows] = useState<GradeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    async function load() {
      if (!assignmentId || !user?.id) return;
      setLoading(true);
      setForbidden(false);

      const entityId = await getTeacherEntityId(user.id);
      const teacherKeys = new Set([user.id, entityId].filter(Boolean) as string[]);
      const teacherBatches = await getTeacherBatches(user.id);
      const batchIds = new Set(teacherBatches.map((b) => b.id));

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, title, teacher_id, batch_id, batches(name)')
        .eq('id', assignmentId)
        .limit(1);

      const assignment = assignmentRows?.[0];
      if (assignmentError || !assignment) {
        toastError(assignmentError, 'Assignment not found.');
        setRows([]);
        setLoading(false);
        return;
      }

      const ownsByTeacher =
        !!assignment.teacher_id && teacherKeys.has(String(assignment.teacher_id));
      const ownsByBatch = !!assignment.batch_id && batchIds.has(String(assignment.batch_id));

      if (!ownsByTeacher && !ownsByBatch) {
        setForbidden(true);
        toastError('Not your assignment.');
        setRows([]);
        setLoading(false);
        return;
      }

      setTitle(assignment.title || 'Grade Submissions');
      const batch = relationOne(assignment.batches as { name?: string } | { name?: string }[] | null);
      setBatchLabel(batch?.name || '');

      const { data, error } = await supabase
        .from('submissions')
        .select(
          `
          id,
          submitted_at,
          youtube_url,
          drive_url,
          status,
          marks,
          remarks,
          students (
            application_id,
            profiles ( full_name, email )
          )
        `,
        )
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) {
        toastError(error, 'Failed to load submissions.');
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((row: Record<string, unknown>) => {
            const student = relationOne(row.students as never);
            const profile = relationOne(
              (student as { profiles?: unknown } | null)?.profiles as never,
            ) as { full_name?: string; email?: string } | null;
            return {
              id: String(row.id),
              studentName: profile?.full_name || 'Unknown Student',
              studentEmail: profile?.email || '-',
              applicationId:
                (student as { application_id?: string | null } | null)?.application_id || '—',
              submitted_at: (row.submitted_at as string | null) ?? null,
              youtube_url: (row.youtube_url as string | null) ?? null,
              drive_url: (row.drive_url as string | null) ?? null,
              status: (row.status as string | null) ?? null,
              marks: row.marks == null ? '' : String(row.marks),
              remarks: (row.remarks as string | null) || '',
            };
          }),
        );
      }
      setLoading(false);
    }

    void load();
  }, [assignmentId, user?.id]);

  const updateRow = (id: string, patch: Partial<GradeDraft>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleSaveAll = async () => {
    if (forbidden) return;
    setSaving(true);

    try {
      for (const row of rows) {
        const marksValue = row.marks.trim() === '' ? null : Number(row.marks);
        if (marksValue != null && (Number.isNaN(marksValue) || marksValue < 0 || marksValue > 100)) {
          throw new Error(`Marks for ${row.studentName} must be between 0 and 100.`);
        }

        const { error } = await supabase
          .from('submissions')
          .update({
            marks: marksValue,
            remarks: row.remarks.trim() || null,
            status: marksValue == null ? row.status || 'Submitted' : 'Graded',
            graded_at: marksValue == null ? null : new Date().toISOString(),
          })
          .eq('id', row.id);

        if (error) throw error;
      }
      toastSuccess('Marks saved.');
    } catch (err: unknown) {
      toastError(err, 'Failed to save grades.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">
            Only you (course teacher) can award marks. Students see scores after you save.
            {batchLabel ? ` · ${batchLabel}` : ''}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/assignments">Back to Assignments</Link>
        </Button>
      </div>

      {forbidden ? null : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-4">SR#</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-4 py-4">App ID</th>
                  <th className="px-6 py-4">Submitted At</th>
                  <th className="px-6 py-4">Links</th>
                  <th className="w-32 px-6 py-4">Marks / 100</th>
                  <th className="px-6 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading submissions...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No student submissions yet for this assignment.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{row.studentName}</div>
                        <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">{row.applicationId}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {row.youtube_url ? (
                            <a
                              href={row.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              YouTube
                            </a>
                          ) : null}
                          {row.drive_url ? (
                            <a
                              href={row.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              Drive
                            </a>
                          ) : null}
                          {!row.youtube_url && !row.drive_url ? (
                            <span className="text-muted-foreground">No links</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={row.marks}
                          onChange={(e) => updateRow(row.id, { marks: e.target.value })}
                          placeholder="0-100"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          value={row.remarks}
                          onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
                          placeholder="Feedback for student"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={handleSaveAll} disabled={saving || rows.length === 0 || loading} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save All Marks'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

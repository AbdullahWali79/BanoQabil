import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { ensureStudentRow } from '@/features/teacher/utils/teacherData';
import { getStudentContext } from '@/features/student/utils/studentData';

type Course = {
  id: string;
  name: string;
};

type Batch = {
  id: string;
  name?: string | null;
  batch_name?: string | null;
  title?: string | null;
  course_id: string | null;
  timing?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

function getBatchLabel(batch: Batch): string {
  const raw = batch.name || batch.batch_name || batch.title || `Batch ${batch.id.slice(0, 6)}`;
  return raw.replace(/^tid:[a-f0-9-]+\|/i, '');
}

export default function StudentSetupPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentRowId, setStudentRowId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [lockedByAdmin, setLockedByAdmin] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSetupData() {
      if (!user?.id) return;
      setLoading(true);
      setMessage(null);

      const ctx = await getStudentContext(user.id);
      setCourseName(ctx?.courseName || '');
      setBatchName(ctx?.batchName || '');

      const [{ data: courseRows }, { data: batchRows }, { data: studentRow, error: studentError }] =
        await Promise.all([
          supabase.from('courses').select('id, name').order('name'),
          supabase.from('batches').select('*'),
          supabase.from('students').select('id, batch_id, course_id').eq('profile_id', user.id).limit(1),
        ]);

      let student = studentRow?.[0] ?? null;

      if (!student && !studentError) {
        try {
          const createdId = await ensureStudentRow(user.id);
          if (createdId) student = { id: createdId, batch_id: null, course_id: null };
        } catch (err: unknown) {
          setMessage({
            type: 'error',
            text:
              err instanceof Error
                ? err.message
                : 'Student profile not found. Please ask admin to create your student record first.',
          });
          setLoading(false);
          return;
        }
      }

      if (studentError || !student) {
        setMessage({
          type: 'error',
          text: 'Student profile not found. Please ask admin to create your student record first.',
        });
        setLoading(false);
        return;
      }

      setStudentRowId(student.id);
      setCourses((courseRows ?? []) as Course[]);
      setBatches((batchRows ?? []) as Batch[]);

      if (student.batch_id) {
        setLockedByAdmin(true);
        const selectedBatch = (batchRows ?? []).find((b) => b.id === student.batch_id);
        if (selectedBatch) {
          setSelectedBatchId(selectedBatch.id);
          setSelectedCourseId(selectedBatch.course_id ?? student.course_id ?? '');
        }
      }

      setLoading(false);
    }

    void loadSetupData();
  }, [user?.id]);

  const filteredBatches = useMemo(
    () => batches.filter((batch) => (batch.course_id ?? '') === selectedCourseId),
    [batches, selectedCourseId],
  );

  const selectedBatch = filteredBatches.find((batch) => batch.id === selectedBatchId);

  const handleSave = async () => {
    if (lockedByAdmin) {
      setMessage({
        type: 'error',
        text: 'Your class is assigned by admin. Contact admin to change course/batch.',
      });
      return;
    }
    if (!studentRowId || !selectedBatchId) {
      setMessage({ type: 'error', text: 'Please select your course and batch before saving.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('students')
      .update({
        batch_id: selectedBatchId,
        course_id: selectedCourseId || null,
      })
      .eq('id', studentRowId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Course and batch saved.' });
      setLockedByAdmin(true);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">My Course & Batch</h1>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading your enrollment...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Course & Batch</h1>
        <p className="mt-1 text-muted-foreground">
          {lockedByAdmin
            ? 'Enrollment is managed by admin. You can view your class here.'
            : 'If admin has not assigned you yet, select your course/batch once — then it locks.'}
        </p>
      </div>

      {lockedByAdmin ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="space-y-3 p-6">
            <p className="font-semibold text-emerald-950">You are enrolled</p>
            <p className="text-sm text-emerald-900/80">
              Course: <strong>{courseName || '—'}</strong>
              <br />
              Batch: <strong>{batchName || '—'}</strong>
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link to="/dashboard/my-assignments">Go to Assignments</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard/my-profile">View Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedBatchId('');
                }}
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Batch</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={!selectedCourseId}
              >
                <option value="">Select Batch</option>
                {filteredBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {getBatchLabel(batch)}
                  </option>
                ))}
              </select>
            </div>

            {selectedBatch ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Timing:</span>{' '}
                  {selectedBatch.timing || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Duration:</span>{' '}
                  {selectedBatch.start_date
                    ? new Date(selectedBatch.start_date).toLocaleDateString()
                    : '-'}{' '}
                  to{' '}
                  {selectedBatch.end_date
                    ? new Date(selectedBatch.end_date).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            ) : null}

            {message ? (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border border-green-300 bg-green-50 text-green-700'
                    : 'border border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={saving || !selectedBatchId}>
                {saving ? 'Saving...' : 'Save Enrollment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {message && lockedByAdmin ? (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-green-300 bg-green-50 text-green-700'
              : 'border border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

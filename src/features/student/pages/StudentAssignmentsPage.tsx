import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Search } from 'lucide-react';
import {
  getStudentContext,
  resolveTeacherContact,
  type TeacherContact,
} from '@/features/student/utils/studentData';
import { TeacherInfoCard } from '@/features/student/components/TeacherInfoCard';

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  created_at: string;
  teacher_id?: string | null;
  teacher?: TeacherContact | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  status: string | null;
  youtube_url: string | null;
  drive_url: string | null;
  marks: number | null;
  remarks: string | null;
};

function marksTone(marks: number) {
  if (marks >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (marks >= 50) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-red-200 bg-red-50 text-red-800';
}

export default function StudentAssignmentsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classTeacher, setClassTeacher] = useState<TeacherContact | null>(null);
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, SubmissionRow>>({});
  const [draftLinks, setDraftLinks] = useState<
    Record<string, { youtube_url: string; drive_url: string }>
  >({});
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    async function loadAssignments() {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage('');

      const ctx = await getStudentContext(user.id);
      if (!ctx) {
        setErrorMessage('Student profile not found. Please contact admin.');
        setLoading(false);
        return;
      }

      setStudentId(ctx.studentId);
      setClassTeacher(ctx.teacher);
      setCourseName(ctx.courseName);
      setBatchName(ctx.batchName);

      if (!ctx.batchId) {
        setErrorMessage('You are not assigned to any batch yet. Ask admin to assign your class.');
        setAssignments([]);
        setLoading(false);
        return;
      }

      if (!ctx.teacher) {
        setErrorMessage(
          'No course teacher is assigned to your class yet. Assignments cannot be submitted until admin assigns your teacher.',
        );
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, status, created_at, teacher_id')
        .eq('batch_id', ctx.batchId)
        .order('due_date', { ascending: true });

      if (assignmentError) {
        setErrorMessage(`Failed to load assignments: ${assignmentError.message}`);
        setLoading(false);
        return;
      }

      const rows = (assignmentData ?? []) as AssignmentRow[];
      const teacherCache = new Map<string, TeacherContact | null>();
      if (ctx.teacher?.teacherId) {
        teacherCache.set(ctx.teacher.teacherId, ctx.teacher);
      }

      for (const row of rows) {
        const key = row.teacher_id || ctx.teacher?.teacherId || '';
        if (!key) {
          row.teacher = ctx.teacher;
          continue;
        }
        if (!teacherCache.has(key)) {
          teacherCache.set(key, (await resolveTeacherContact(key)) || ctx.teacher);
        }
        row.teacher = teacherCache.get(key) || ctx.teacher;
      }

      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('id, assignment_id, status, youtube_url, drive_url, marks, remarks')
        .eq('student_id', ctx.studentId);

      if (submissionError) {
        setErrorMessage(`Failed to load submissions: ${submissionError.message}`);
      }

      const map: Record<string, SubmissionRow> = {};
      const draft: Record<string, { youtube_url: string; drive_url: string }> = {};
      (submissionData ?? []).forEach((item) => {
        const row = item as SubmissionRow;
        map[row.assignment_id] = row;
        draft[row.assignment_id] = {
          youtube_url: row.youtube_url ?? '',
          drive_url: row.drive_url ?? '',
        };
      });

      setAssignments(rows);
      setSubmissionsMap(map);
      setDraftLinks(draft);
      setLoading(false);
    }

    void loadAssignments();
  }, [user?.id]);

  const filtered = useMemo(
    () =>
      assignments.filter((a) =>
        `${a.title} ${a.description ?? ''} ${a.teacher?.fullName ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [assignments, search],
  );

  const handleSubmitLinks = async (assignmentId: string) => {
    if (!studentId) return;
    if (!classTeacher) {
      setErrorMessage('Cannot submit — your course teacher is not assigned yet.');
      return;
    }

    const assignment = assignments.find((a) => a.id === assignmentId);
    const existing = submissionsMap[assignmentId];
    const isGraded = existing?.status === 'Graded' || existing?.marks != null;

    if (isGraded) {
      setErrorMessage(
        'This assignment is already graded. You cannot change the submission. Contact your teacher if needed.',
      );
      return;
    }

    if (assignment?.status === 'Closed' && !existing) {
      setErrorMessage('This assignment is closed. New submissions are not allowed.');
      return;
    }

    const payload = draftLinks[assignmentId] ?? { youtube_url: '', drive_url: '' };

    if (!payload.youtube_url.trim() && !payload.drive_url.trim()) {
      setErrorMessage('Please add at least one link (YouTube or Drive) before submitting.');
      return;
    }

    setSavingId(assignmentId);
    setErrorMessage('');
    setSuccessMessage('');

    const basePayload = {
      youtube_url: payload.youtube_url.trim() || null,
      drive_url: payload.drive_url.trim() || null,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await supabase
          .from('submissions')
          .update(basePayload)
          .eq('id', existing.id)
          .eq('student_id', studentId)
          .select('id, assignment_id, status, youtube_url, drive_url, marks, remarks')
          .single()
      : await supabase
          .from('submissions')
          .insert([{ ...basePayload, student_id: studentId, assignment_id: assignmentId }])
          .select('id, assignment_id, status, youtube_url, drive_url, marks, remarks')
          .single();

    if (error || !data) {
      setErrorMessage(`Could not submit assignment: ${error?.message || 'Unknown error'}`);
      setSavingId('');
      return;
    }

    const row = data as SubmissionRow;
    setSubmissionsMap((prev) => ({ ...prev, [assignmentId]: row }));
    setDraftLinks((prev) => ({
      ...prev,
      [assignmentId]: {
        youtube_url: row.youtube_url ?? '',
        drive_url: row.drive_url ?? '',
      },
    }));
    setSuccessMessage(
      `Submitted to ${classTeacher.fullName}. Your teacher will review and give marks.`,
    );
    setSavingId('');
  };

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="mt-1 text-muted-foreground">
            Submit work to your course teacher. After grading, marks appear here and on{' '}
            <Link to="/dashboard/my-grades" className="font-medium text-primary hover:underline">
              My Grades
            </Link>
            .
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="pl-9"
          />
        </div>
      </div>

      <TeacherInfoCard teacher={classTeacher} courseName={courseName} batchName={batchName} />

      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading assignments...
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-10 w-10 opacity-30" />
              No assignments from your teacher yet.
            </CardContent>
          </Card>
        ) : (
          filtered.map((assignment, index) => {
            const submission = submissionsMap[assignment.id];
            const draft = draftLinks[assignment.id] ?? { youtube_url: '', drive_url: '' };
            const dueDate = new Date(assignment.due_date);
            const isClosed = assignment.status === 'Closed';
            const isGraded = submission?.status === 'Graded' || submission?.marks != null;
            const isOverdue = dueDate.getTime() < Date.now() && !submission && !isClosed;
            const locked = isGraded || (isClosed && !submission);
            const teacherName = assignment.teacher?.fullName || classTeacher?.fullName || 'Teacher';

            return (
              <Card key={assignment.id}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">SR# {index + 1}</p>
                      <h2 className="text-lg font-semibold">{assignment.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Due {dueDate.toLocaleString()} · Submit to {teacherName}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isGraded
                          ? 'bg-emerald-100 text-emerald-800'
                          : submission
                            ? 'bg-blue-100 text-blue-800'
                            : isOverdue
                              ? 'bg-red-100 text-red-700'
                              : isClosed
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isGraded
                        ? 'Graded'
                        : submission
                          ? 'Submitted — awaiting marks'
                          : isOverdue
                            ? 'Overdue'
                            : isClosed
                              ? 'Closed'
                              : 'Pending submission'}
                    </span>
                  </div>

                  <TeacherInfoCard teacher={assignment.teacher || classTeacher} compact />

                  {assignment.description ? (
                    <p className="text-sm text-muted-foreground">{assignment.description}</p>
                  ) : null}

                  {isGraded && submission?.marks != null ? (
                    <div
                      className={`rounded-xl border px-4 py-3 ${marksTone(submission.marks)}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        Your marks
                      </p>
                      <p className="mt-1 text-2xl font-bold">{submission.marks} / 100</p>
                      {submission.remarks ? (
                        <p className="mt-1 text-sm">Teacher remark: {submission.remarks}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        YouTube Link
                      </label>
                      <Input
                        value={draft.youtube_url}
                        onChange={(e) =>
                          setDraftLinks((prev) => ({
                            ...prev,
                            [assignment.id]: {
                              youtube_url: e.target.value,
                              drive_url: prev[assignment.id]?.drive_url ?? draft.drive_url,
                            },
                          }))
                        }
                        placeholder="https://youtube.com/..."
                        disabled={locked}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Google Drive Link
                      </label>
                      <Input
                        value={draft.drive_url}
                        onChange={(e) =>
                          setDraftLinks((prev) => ({
                            ...prev,
                            [assignment.id]: {
                              youtube_url: prev[assignment.id]?.youtube_url ?? draft.youtube_url,
                              drive_url: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://drive.google.com/..."
                        disabled={locked}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {isGraded
                        ? 'Locked after grading. View all scores on My Grades.'
                        : submission
                          ? 'You can update links until your teacher grades this.'
                          : 'Submit at least one link for your teacher to review.'}
                    </p>
                    <Button
                      onClick={() => handleSubmitLinks(assignment.id)}
                      disabled={
                        savingId === assignment.id || locked || !classTeacher
                      }
                    >
                      {savingId === assignment.id
                        ? 'Submitting...'
                        : isGraded
                          ? 'Graded'
                          : submission
                            ? 'Update Submission'
                            : 'Submit to Teacher'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Search, Send, Users } from 'lucide-react';
import {
  getTeacherStudents,
  relationOne,
  resolveStudentGender,
} from '@/features/teacher/utils/teacherData';

type Student = {
  id: string;
  application_id?: string | null;
  gender?: string | null;
  batches?: { name?: string | null } | { name?: string | null }[] | null;
  profiles?:
    | { id?: string; full_name?: string | null; email?: string | null }
    | { id?: string; full_name?: string | null; email?: string | null }[]
    | null;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  recipient_id: string;
};

type SendMode = 'single' | 'class' | 'female' | 'male';

export default function TeacherNotificationsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [sent, setSent] = useState<NotificationRow[]>([]);
  const [recipientProfileId, setRecipientProfileId] = useState(
    () => searchParams.get('student') || '',
  );
  const [studentSearch, setStudentSearch] = useState(() => searchParams.get('q') || '');
  const [sendMode, setSendMode] = useState<SendMode>(() => {
    const mode = searchParams.get('mode');
    return mode === 'class' || mode === 'female' || mode === 'male' || mode === 'single'
      ? mode
      : 'single';
  });
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let list: Student[] = [];
      try {
        list = await getTeacherStudents<Student>(
          user.id,
          'id, application_id, gender, batches(name), profiles(id, full_name, email)',
        );
      } catch {
        list = await getTeacherStudents<Student>(
          user.id,
          'id, application_id, profiles(id, full_name, email)',
        );
      }
      setStudents(list);

      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, is_read, recipient_id')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);
      setSent((data as NotificationRow[]) ?? []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err?.message ||
          'Failed to load. Run teacher_attendance_notifications.sql in Supabase.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    const student = searchParams.get('student');
    const q = searchParams.get('q');
    const mode = searchParams.get('mode');
    if (student) {
      setRecipientProfileId(student);
      setSendMode('single');
    }
    if (q) setStudentSearch(q);
    if (mode === 'class' || mode === 'female' || mode === 'male' || mode === 'single') {
      setSendMode(mode);
    }
  }, [searchParams]);

  const enriched = useMemo(
    () =>
      students
        .map((s) => {
          const p = relationOne(s.profiles);
          return {
            ...s,
            profile: p,
            gender: resolveStudentGender({
              gender: s.gender,
              batchName: relationOne(s.batches)?.name,
            }),
          };
        })
        .filter((s) => s.profile?.id),
    [students],
  );

  const searchedStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return enriched;
    return enriched.filter(
      (s) =>
        (s.profile?.full_name || '').toLowerCase().includes(q) ||
        (s.profile?.email || '').toLowerCase().includes(q) ||
        (s.application_id || '').toLowerCase().includes(q),
    );
  }, [enriched, studentSearch]);

  const recipientsForMode = useMemo(() => {
    if (sendMode === 'single') {
      return enriched.filter((s) => s.profile?.id === recipientProfileId);
    }
    if (sendMode === 'female') return enriched.filter((s) => s.gender === 'Female');
    if (sendMode === 'male') return enriched.filter((s) => s.gender === 'Male');
    return enriched; // whole class
  }, [sendMode, enriched, recipientProfileId]);

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!title.trim() || !message.trim()) {
      setFeedback({ type: 'error', text: 'Enter title and message.' });
      return;
    }
    if (sendMode === 'single' && !recipientProfileId) {
      setFeedback({ type: 'error', text: 'Search and select a student, or choose Whole Class.' });
      return;
    }
    if (recipientsForMode.length === 0) {
      setFeedback({ type: 'error', text: 'No recipients found for this option.' });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      const rows = recipientsForMode.map((s) => ({
        sender_id: user.id,
        recipient_id: s.profile!.id!,
        title: title.trim(),
        message: message.trim(),
        is_read: false,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;

      setTitle('');
      setMessage('');
      setRecipientProfileId('');
      setStudentSearch('');
      setFeedback({
        type: 'success',
        text:
          sendMode === 'single'
            ? 'Notification sent to selected student.'
            : `Notification sent to ${rows.length} student(s).`,
      });
      await load();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err?.message ||
          'Send failed. Run teacher_attendance_notifications.sql in Supabase SQL Editor.',
      });
    } finally {
      setSending(false);
    }
  };

  const recipientName = (recipientId: string) => {
    const hit = enriched.find((s) => s.profile?.id === recipientId);
    return hit?.profile?.full_name || hit?.profile?.email || recipientId.slice(0, 8) + 'â€¦';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Search a student, or send to whole class / Female / Male group.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['single', 'One Student'],
                ['class', 'Whole Class'],
                ['female', 'All Female'],
                ['male', 'All Male'],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={sendMode === mode ? 'default' : 'outline'}
                onClick={() => setSendMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>

          <form onSubmit={sendNotification} className="space-y-4 max-w-2xl">
            {sendMode === 'single' && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Search student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Type name, email, or App ID..."
                  />
                </div>
                <div className="rounded-md border max-h-48 overflow-auto">
                  {searchedStudents.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No students found.</p>
                  ) : (
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs sticky top-0">
                        <tr>
                          <th className="px-3 py-2">SR#</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">App ID</th>
                          <th className="px-3 py-2">Select</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchedStudents.map((s, i) => (
                          <tr
                            key={s.id}
                            className={`border-t cursor-pointer ${
                              recipientProfileId === s.profile?.id ? 'bg-primary/10' : ''
                            }`}
                            onClick={() => setRecipientProfileId(s.profile?.id || '')}
                          >
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{s.profile?.full_name}</div>
                              <div className="text-xs text-muted-foreground">{s.profile?.email}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{s.application_id || 'â€”'}</td>
                            <td className="px-3 py-2">
                              <input
                                type="radio"
                                name="notif-student"
                                checked={recipientProfileId === s.profile?.id}
                                onChange={() => setRecipientProfileId(s.profile?.id || '')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {sendMode !== 'single' && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Will send to <strong>{recipientsForMode.length}</strong> student(s)
                {sendMode === 'class'
                  ? ' (whole class)'
                  : sendMode === 'female'
                    ? ' (Female)'
                    : ' (Male)'}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Class reminder"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
              />
            </div>
            <Button type="submit" disabled={sending || loading}>
              <Send className="mr-2 h-4 w-4" />
              {sending
                ? 'Sending...'
                : sendMode === 'single'
                  ? 'Send to Student'
                  : `Send to ${recipientsForMode.length} Students`}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently sent</h2>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading...</p>
            ) : sent.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Bell className="mx-auto mb-2 h-10 w-10 opacity-30" />
                No notifications sent yet.
              </div>
            ) : (
              <ul className="divide-y">
                {sent.map((n, i) => (
                  <li key={n.id} className="px-4 py-3">
                    <div className="flex gap-3">
                      <span className="text-xs text-muted-foreground w-8 shrink-0 pt-1">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{n.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          To: {recipientName(n.recipient_id)} Â·{' '}
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

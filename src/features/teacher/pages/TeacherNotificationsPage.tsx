import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { askConfirm } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Send,
  Trash2,
  User,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  getTeacherAssignedCourse,
  getTeacherStudents,
  relationOne,
  resolveStudentGender,
  type GenderScope,
} from '@/features/teacher/utils/teacherData';
import { TeacherAssignmentGate } from '@/features/teacher/components/TeacherAssignmentGate';

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

type SendMode = 'selected' | 'class' | 'female' | 'male';

type SentGroup = {
  key: string;
  title: string;
  message: string;
  created_at: string;
  ids: string[];
  recipientIds: string[];
};

const RECENT_PAGE_SIZE = 6;

const MODE_OPTIONS: {
  mode: SendMode;
  label: string;
  hint: string;
  icon: typeof User;
}[] = [
  { mode: 'selected', label: 'Selected Students', hint: 'Pick multiple', icon: User },
  { mode: 'class', label: 'Whole Class', hint: 'Everyone', icon: UsersRound },
  { mode: 'female', label: 'All Female', hint: 'Female only', icon: Users },
  { mode: 'male', label: 'All Male', hint: 'Male only', icon: Users },
];

function parseSendMode(raw: string | null): SendMode | null {
  if (raw === 'class' || raw === 'female' || raw === 'male' || raw === 'selected') return raw;
  if (raw === 'single') return 'selected'; // legacy URL from My Class
  return null;
}

function groupSent(rows: NotificationRow[]): SentGroup[] {
  const groups: SentGroup[] = [];
  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    const last = groups[groups.length - 1];
    if (
      last &&
      last.title === row.title &&
      last.message === row.message &&
      Math.abs(new Date(last.created_at).getTime() - t) < 3000
    ) {
      last.ids.push(row.id);
      last.recipientIds.push(row.recipient_id);
    } else {
      groups.push({
        key: row.id,
        title: row.title,
        message: row.message,
        created_at: row.created_at,
        ids: [row.id],
        recipientIds: [row.recipient_id],
      });
    }
  }
  return groups;
}

export default function TeacherNotificationsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [sent, setSent] = useState<NotificationRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const student = searchParams.get('student');
    return student ? [student] : [];
  });
  const [studentSearch, setStudentSearch] = useState(() => searchParams.get('q') || '');
  const [sendMode, setSendMode] = useState<SendMode>(
    () => parseSendMode(searchParams.get('mode')) ?? 'selected',
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [genderScope, setGenderScope] = useState<GenderScope | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const assigned = await getTeacherAssignedCourse(user.id);
      setCourseName(assigned?.name ?? null);
      setGenderScope(assigned?.genderScope ?? null);

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

      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, is_read, recipient_id')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      setSent((data as NotificationRow[]) ?? []);
    } catch (err: unknown) {
      toastError(
        err,
        'Failed to load notifications. Run teacher_attendance_notifications.sql in Supabase.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const student = searchParams.get('student');
    const q = searchParams.get('q');
    const mode = parseSendMode(searchParams.get('mode'));
    if (student) {
      setSelectedIds((prev) => (prev.includes(student) ? prev : [...prev, student]));
      setSendMode('selected');
    }
    if (q) setStudentSearch(q);
    if (mode) setSendMode(mode);
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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
    if (sendMode === 'selected') {
      return enriched.filter((s) => s.profile?.id && selectedIdSet.has(s.profile.id));
    }
    if (sendMode === 'female') return enriched.filter((s) => s.gender === 'Female');
    if (sendMode === 'male') return enriched.filter((s) => s.gender === 'Male');
    return enriched;
  }, [sendMode, enriched, selectedIdSet]);

  const toggleSelected = (profileId: string) => {
    setSelectedIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    );
  };

  const selectAllVisible = () => {
    const ids = searchedStudents
      .map((s) => s.profile?.id)
      .filter((id): id is string => Boolean(id));
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => setSelectedIds([]);

  const allVisibleSelected =
    searchedStudents.length > 0 &&
    searchedStudents.every((s) => s.profile?.id && selectedIdSet.has(s.profile.id));

  const sentGroups = useMemo(() => groupSent(sent), [sent]);

  const recentTotalPages = Math.max(1, Math.ceil(sentGroups.length / RECENT_PAGE_SIZE));
  const recentCurrentPage = Math.min(recentPage, recentTotalPages);

  const pagedSentGroups = useMemo(() => {
    const start = (recentCurrentPage - 1) * RECENT_PAGE_SIZE;
    return sentGroups.slice(start, start + RECENT_PAGE_SIZE);
  }, [sentGroups, recentCurrentPage]);

  useEffect(() => {
    setRecentPage(1);
  }, [sent.length]);

  useEffect(() => {
    if (recentPage > recentTotalPages) setRecentPage(recentTotalPages);
  }, [recentPage, recentTotalPages]);

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!title.trim() || !message.trim()) {
      toastError('Enter title and message.');
      return;
    }
    if (sendMode === 'selected' && selectedIds.length === 0) {
      toastError('Select at least one student.');
      return;
    }
    if (recipientsForMode.length === 0) {
      toastError('No recipients found for this option.');
      return;
    }

    setSending(true);
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
      setSelectedIds([]);
      setStudentSearch('');
      toastSuccess(`Notification sent to ${rows.length} student(s).`);
      await load();
    } catch (err: unknown) {
      toastError(
        err,
        'Send failed. Run teacher_attendance_notifications.sql in Supabase SQL Editor.',
      );
    } finally {
      setSending(false);
    }
  };

  const clearAllRecents = async () => {
    if (!user?.id || sent.length === 0) return;
    const ok = await askConfirm({
      title: 'Clear all recent notifications?',
      description: `This removes ${sent.length} notification(s) you sent from your recent list. Students who already received them will also lose those messages.`,
      confirmLabel: 'Clear all',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    setClearing(true);
    try {
      const { error } = await supabase.from('notifications').delete().eq('sender_id', user.id);
      if (error) throw error;
      setSent([]);
      toastSuccess('Recent notifications cleared.');
    } catch (err: unknown) {
      toastError(err, 'Could not clear notifications.');
    } finally {
      setClearing(false);
    }
  };

  const clearGroup = async (group: SentGroup) => {
    if (!user?.id) return;
    const ok = await askConfirm({
      title: 'Remove this notification?',
      description:
        group.ids.length > 1
          ? `Removes this message for ${group.ids.length} recipients.`
          : 'Removes this message from recent history.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('sender_id', user.id)
        .in('id', group.ids);
      if (error) throw error;
      setSent((prev) => prev.filter((n) => !group.ids.includes(n.id)));
      toastSuccess('Notification removed.');
    } catch (err: unknown) {
      toastError(err, 'Could not remove notification.');
    }
  };

  const recipientName = (recipientId: string) => {
    const hit = enriched.find((s) => s.profile?.id === recipientId);
    return hit?.profile?.full_name || hit?.profile?.email || `${recipientId.slice(0, 8)}…`;
  };

  const audienceLabel =
    sendMode === 'selected'
      ? selectedIds.length === 0
        ? 'Select students'
        : selectedIds.length === 1
          ? recipientName(selectedIds[0])
          : `${selectedIds.length} students selected`
      : sendMode === 'class'
        ? `Whole class (${recipientsForMode.length})`
        : sendMode === 'female'
          ? `All Female (${recipientsForMode.length})`
          : `All Male (${recipientsForMode.length})`;

  return (
    <TeacherAssignmentGate courseName={courseName} genderScope={genderScope} loading={loading}>
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {courseName
                ? `${courseName}${genderScope ? ` · ${genderScope}` : ''}`
                : 'Send updates to selected students or a group'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground">{sentGroups.length}</span> recent
              {sentGroups.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          {/* Compose */}
          <Card className="border shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div>
                <h2 className="text-base font-semibold">Compose</h2>
                <p className="text-xs text-muted-foreground">
                  Choose audience, write your message, then send.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODE_OPTIONS.map(({ mode, label, hint, icon: Icon }) => {
                  const active = sendMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSendMode(mode)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`mb-1.5 h-4 w-4 ${active ? 'opacity-90' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className={`mt-0.5 text-[11px] ${active ? 'opacity-80' : 'text-muted-foreground'}`}>
                        {hint}
                      </p>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={sendNotification} className="space-y-4">
                {sendMode === 'selected' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-medium">Select students</label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={searchedStudents.length === 0 || allVisibleSelected}
                          onClick={selectAllVisible}
                        >
                          Select visible
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={selectedIds.length === 0}
                          onClick={clearSelection}
                        >
                          Clear ({selectedIds.length})
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Type name, email, or App ID…"
                      />
                    </div>
                    <div className="max-h-52 overflow-auto rounded-lg border">
                      {searchedStudents.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">No students found.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 border-b bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                            <tr>
                              <th className="px-3 py-2 font-semibold">SR#</th>
                              <th className="px-3 py-2 font-semibold">Name</th>
                              <th className="px-3 py-2 font-semibold">App ID</th>
                              <th className="px-3 py-2 font-semibold">Select</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {searchedStudents.map((s, i) => {
                              const id = s.profile?.id || '';
                              const active = id ? selectedIdSet.has(id) : false;
                              return (
                                <tr
                                  key={s.id}
                                  className={`cursor-pointer transition-colors ${
                                    active ? 'bg-primary/10' : 'hover:bg-muted/40'
                                  }`}
                                  onClick={() => id && toggleSelected(id)}
                                >
                                  <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="font-medium">{s.profile?.full_name}</div>
                                    <div className="truncate text-xs text-muted-foreground">
                                      {s.profile?.email}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-xs">
                                    {s.application_id || '—'}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-primary"
                                      checked={active}
                                      onChange={() => id && toggleSelected(id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedIds.length === 0
                        ? 'Tick one or more students to send together.'
                        : `${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} selected`}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{audienceLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        Message will go to every matching student in your class.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Class reminder"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">Message</label>
                    <span className="text-[11px] text-muted-foreground">{message.length}/1000</span>
                  </div>
                  <textarea
                    className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                    placeholder="Write your message…"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    To: <span className="font-medium text-foreground">{audienceLabel}</span>
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      sending ||
                      loading ||
                      (sendMode === 'selected'
                        ? selectedIds.length === 0
                        : recipientsForMode.length === 0)
                    }
                    className="gap-2"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sending
                      ? 'Sending…'
                      : sendMode === 'selected'
                        ? `Send to ${selectedIds.length || 0}`
                        : `Send to ${recipientsForMode.length}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Recents */}
          <Card className="border shadow-sm xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:flex xl:flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold">Recently sent</h2>
                  <p className="text-xs text-muted-foreground">
                    {sentGroups.length} recent{sentGroups.length === 1 ? '' : 's'}
                    {sentGroups.length > RECENT_PAGE_SIZE
                      ? ` · page ${recentCurrentPage}/${recentTotalPages}`
                      : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={clearing || sent.length === 0}
                  onClick={() => void clearAllRecents()}
                >
                  {clearing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Clear all
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : sentGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No notifications yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sent messages will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {pagedSentGroups.map((g) => (
                      <li key={g.key} className="px-4 py-3.5 hover:bg-muted/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{g.title}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {g.message}
                            </p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {g.recipientIds.length > 1
                                ? `To ${g.recipientIds.length} students`
                                : `To ${recipientName(g.recipientIds[0])}`}
                              {' · '}
                              {new Date(g.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            title="Remove"
                            onClick={() => void clearGroup(g)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {sentGroups.length > RECENT_PAGE_SIZE ? (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {(recentCurrentPage - 1) * RECENT_PAGE_SIZE + 1}–
                    {Math.min(recentCurrentPage * RECENT_PAGE_SIZE, sentGroups.length)} of{' '}
                    {sentGroups.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={recentCurrentPage <= 1}
                      onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[3.5rem] text-center text-xs font-medium">
                      {recentCurrentPage}/{recentTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={recentCurrentPage >= recentTotalPages}
                      onClick={() => setRecentPage((p) => Math.min(recentTotalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherAssignmentGate>
  );
}

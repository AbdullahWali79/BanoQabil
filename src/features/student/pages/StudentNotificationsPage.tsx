import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { getStudentContext, type TeacherContact } from '@/features/student/utils/studentData';
import { TeacherInfoCard } from '@/features/student/components/TeacherInfoCard';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  sender_id?: string | null;
  senderName?: string;
};

export default function StudentNotificationsPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [teacher, setTeacher] = useState<TeacherContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');

    const ctx = await getStudentContext(user.id);
    setTeacher(ctx?.teacher ?? null);

    const { data, error: err } = await supabase
      .from('notifications')
      .select('id, title, message, created_at, is_read, sender_id')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (data as NotificationRow[]) ?? [];
    const senderIds = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();

    if (senderIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);
      for (const p of profiles ?? []) {
        nameById.set(p.id, p.full_name || 'Teacher');
      }
    }

    setItems(
      rows.map((n) => ({
        ...n,
        senderName:
          (n.sender_id && nameById.get(n.sender_id)) || ctx?.teacher?.fullName || 'Teacher',
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    setMarkingAll(true);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            Messages from your course teacher
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}.
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()} disabled={markingAll}>
            {markingAll ? 'Updating…' : 'Mark all read'}
          </Button>
        ) : null}
      </div>

      <TeacherInfoCard teacher={teacher} compact />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-10 w-10 opacity-30" />
              No notifications yet from your teacher.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n, i) => (
                <li key={n.id} className={`px-4 py-4 ${n.is_read ? '' : 'bg-primary/5'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">#{i + 1}</p>
                        {!n.is_read ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="font-medium">{n.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        From: {n.senderName}
                        {teacher?.phone && teacher.phone !== '—' ? ` · ${teacher.phone}` : ''} ·{' '}
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read ? (
                      <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

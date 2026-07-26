import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function TeacherAssignmentsPage() {
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    async function loadAssignments() {
      if (!user) return;
      const { data } = await supabase
        .from('assignments')
        .select(`*, batches(name)`)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setAssignments(data);
    }
    loadAssignments();
  }, [user]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Assignments</h1>
        <Button className="flex items-center gap-2"><Plus className="w-4 h-4"/> Create Assignment</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Deadline</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} className="border-b">
                  <td className="px-6 py-4 font-medium">{a.title}</td>
                  <td className="px-6 py-4">{a.batches?.name}</td>
                  <td className="px-6 py-4">{new Date(a.due_date).toLocaleString()}</td>
                  <td className="px-6 py-4">{a.status}</td>
                  <td className="px-6 py-4">
                    <Button variant="outline" size="sm">Grade Submissions</Button>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No assignments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

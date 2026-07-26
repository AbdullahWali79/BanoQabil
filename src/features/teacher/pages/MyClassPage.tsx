import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Student {
  id: string;
  application_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function MyClassPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchClass() {
      if (!user) return;
      try {
        const { data: batches } = await supabase
          .from('batches')
          .select('id')
          .eq('teacher_id', user.id);

        const batchIds = batches?.map(b => b.id) || [];
        if (batchIds.length > 0) {
          const { data } = await supabase
            .from('students')
            .select(`
              id,
              application_id,
              profiles ( full_name, email )
            `)
            .in('batch_id', batchIds);
          setStudents(data as any || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchClass();
  }, [user]);

  const filtered = students.filter(s => 
    s.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">My Class</h1>
      
      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-gray-500" />
        <Input 
          placeholder="Search students..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Application ID</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
                ) : filtered.map(student => (
                  <tr key={student.id} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 font-medium">{student.profiles?.full_name}</td>
                    <td className="px-6 py-4">{student.profiles?.email}</td>
                    <td className="px-6 py-4">{student.application_id}</td>
                    <td className="px-6 py-4 text-blue-600">View History</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

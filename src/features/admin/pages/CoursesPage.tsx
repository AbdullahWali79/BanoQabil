import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Calendar, Plus } from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'batches'>('courses');

  const fetchData = async () => {
    setLoading(true);
    const [coursesRes, batchesRes] = await Promise.all([
      supabase.from('courses').select('*'),
      supabase.from('batches').select('*, courses(name), teachers(profiles(full_name))')
    ]);
    
    if (coursesRes.data) setCourses(coursesRes.data);
    if (batchesRes.data) setBatches(batchesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Batches</h1>
          <p className="text-muted-foreground mt-1">Manage curriculum and class schedules</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setActiveTab('courses')} variant={activeTab === 'courses' ? 'default' : 'outline'}>Courses</Button>
          <Button onClick={() => setActiveTab('batches')} variant={activeTab === 'batches' ? 'default' : 'outline'}>Batches</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : activeTab === 'courses' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Course</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.length === 0 && <p className="text-muted-foreground col-span-full">No courses found.</p>}
            {courses.map(course => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center mb-2">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <CardTitle>{course.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{course.description || 'No description provided.'}</p>
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button variant="ghost" size="sm">Edit Course</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Batch</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {batches.length === 0 && <p className="text-muted-foreground col-span-full">No batches found.</p>}
            {batches.map(batch => (
              <Card key={batch.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{batch.name}</h3>
                      <p className="text-sm text-primary font-medium">{batch.courses?.name}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {batch.timing}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(batch.start_date).toLocaleDateString()} - {new Date(batch.end_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium">Teacher:</span>
                      <span>{batch.teachers?.profiles?.full_name || 'Not assigned'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <Button variant="outline" size="sm">View Students</Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

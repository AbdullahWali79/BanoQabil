import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FolderOpen } from 'lucide-react';

export default function AllAssignmentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Assignments</h1>
          <p className="text-muted-foreground mt-1">Monitor all assignments across batches</p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search assignments..." className="pl-9" />
            </div>
          </div>
          
          <div className="overflow-x-auto p-8 text-center text-slate-500">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>Assignments data table will appear here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

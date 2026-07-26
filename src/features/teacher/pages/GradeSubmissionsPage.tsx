import { Button } from '@/components/ui/button';

export default function GradeSubmissionsPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Grade Submissions</h1>
      
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Submitted At</th>
              <th className="px-6 py-4">Links</th>
              <th className="px-6 py-4 w-32">Marks</th>
              <th className="px-6 py-4">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-gray-500">Use URL params to load specific assignment</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-end">
        <Button>Save All Grades</Button>
      </div>
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';

export default function StudentAssignmentsPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">My Assignments</h1>
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          No assignments available yet.
        </CardContent>
      </Card>
    </div>
  );
}

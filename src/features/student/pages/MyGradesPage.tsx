import { Card, CardContent } from '@/components/ui/card';

export default function MyGradesPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">My Grades</h1>
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          No grades available yet.
        </CardContent>
      </Card>
    </div>
  );
}

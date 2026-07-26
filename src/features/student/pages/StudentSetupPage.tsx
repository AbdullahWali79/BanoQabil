import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function StudentSetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Complete Your Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 text-center">Please select your course and batch to continue.</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Course</label>
            <select className="w-full border rounded-md p-2">
              <option>Select Course</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Batch</label>
            <select className="w-full border rounded-md p-2">
              <option>Select Batch</option>
            </select>
          </div>
          <Button className="w-full">Save & Continue</Button>
        </CardContent>
      </Card>
    </div>
  );
}

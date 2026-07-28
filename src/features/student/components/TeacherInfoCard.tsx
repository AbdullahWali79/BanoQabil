import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, UserRound, Mail } from 'lucide-react';
import type { TeacherContact } from '@/features/student/utils/studentData';
import { teacherLabel } from '@/features/student/utils/studentData';

type Props = {
  teacher: TeacherContact | null;
  courseName?: string;
  batchName?: string;
  compact?: boolean;
};

export function TeacherInfoCard({ teacher, courseName, batchName, compact }: Props) {
  const name = teacherLabel(teacher);
  const phone = teacher?.phone && teacher.phone !== '—' ? teacher.phone : null;
  const email = teacher?.email && teacher.email !== '—' ? teacher.email : null;

  if (compact) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Teacher: </span>
          <span className="font-medium">{name}</span>
        </p>
        {phone && (
          <p>
            <span className="text-muted-foreground">Phone: </span>
            <a href={`tel:${phone}`} className="font-medium text-primary hover:underline">
              {phone}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your Teacher</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="flex items-start gap-2">
          <UserRound className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{name}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">Phone</p>
            {phone ? (
              <a href={`tel:${phone}`} className="font-medium text-primary hover:underline">
                {phone}
              </a>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
        </div>
        {email && (
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Email</p>
              <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">
                {email}
              </a>
            </div>
          </div>
        )}
        {courseName && (
          <div>
            <p className="text-muted-foreground">Course</p>
            <p className="font-medium">{courseName}</p>
          </div>
        )}
        {batchName && batchName !== '—' && (
          <div>
            <p className="text-muted-foreground">Batch / Class</p>
            <p className="font-medium">{batchName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

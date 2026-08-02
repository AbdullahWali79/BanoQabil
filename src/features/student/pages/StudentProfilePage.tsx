import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStudentContext, type TeacherContact } from '@/features/student/utils/studentData';
import { TeacherInfoCard } from '@/features/student/components/TeacherInfoCard';

export default function StudentProfilePage() {
  const { user } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [courseName, setCourseName] = useState('—');
  const [batchName, setBatchName] = useState('—');
  const [gender, setGender] = useState('—');
  const [status, setStatus] = useState('—');
  const [teacher, setTeacher] = useState<TeacherContact | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      const [{ data: profile }, ctx, { data: studentRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email, phone, address, status')
          .eq('id', user.id)
          .limit(1),
        getStudentContext(user.id),
        supabase.from('students').select('father_name').eq('profile_id', user.id).limit(1),
      ]);

      const p = profile?.[0];
      if (p) {
        setFullName(p.full_name || '');
        setEmail(p.email || user.email || '');
        setPhone(p.phone || '');
        setAddress(p.address || '');
        setStatus(p.status || '—');
      }

      if (ctx) {
        setApplicationId(ctx.applicationId || '');
        setCourseName(ctx.courseName);
        setBatchName(ctx.batchName);
        setGender(ctx.gender || '—');
        setTeacher(ctx.teacher);
      }

      if (studentRows?.[0]) {
        setFatherName(studentRows[0].father_name || '');
      }
    }
    load();
  }, [user?.id, user?.email]);

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq('id', user.id);

    if (error) {
      toastError(error, 'Profile update failed.');
    } else {
      await supabase
        .from('students')
        .update({ father_name: fatherName.trim() || null })
        .eq('profile_id', user.id);
      toastSuccess('Profile updated.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Your details, class, and course teacher. Password change is in Settings.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/settings">Password & Settings</Link>
        </Button>
      </div>

      <TeacherInfoCard teacher={teacher} courseName={courseName} batchName={batchName} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Application ID</p>
            <p className="font-mono font-medium">{applicationId || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Gender / Class</p>
            <p className="font-medium">{gender}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Course</p>
            <p className="font-medium">{courseName}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Batch / Class</p>
            <p className="font-medium">{batchName}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Father Name</label>
              <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Address</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

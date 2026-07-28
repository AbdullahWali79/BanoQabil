import { supabase } from '@/lib/supabase';
import {
  cleanBatchDisplayName,
  relationOne,
  resolveStudentGender,
} from '@/features/teacher/utils/teacherData';

export type TeacherContact = {
  teacherId: string | null;
  profileId: string | null;
  fullName: string;
  phone: string;
  email: string;
};

export type StudentContext = {
  studentId: string;
  batchId: string | null;
  courseId: string | null;
  applicationId: string | null;
  gender: string | null;
  courseName: string;
  batchName: string;
  teacher: TeacherContact | null;
};

const EMPTY_TEACHER: TeacherContact = {
  teacherId: null,
  profileId: null,
  fullName: '—',
  phone: '—',
  email: '—',
};

async function profileToTeacher(
  teacherId: string | null,
  profile:
    | { id?: string; full_name?: string | null; phone?: string | null; email?: string | null }
    | null,
): Promise<TeacherContact | null> {
  if (!profile?.id && !teacherId) return null;
  return {
    teacherId,
    profileId: profile?.id ?? null,
    fullName: profile?.full_name?.trim() || '—',
    phone: profile?.phone?.trim() || '—',
    email: profile?.email?.trim() || '—',
  };
}

/** Resolve teacher contact from teachers.id or profile id stored on batch/assignment. */
export async function resolveTeacherContact(
  teacherKey: string | null | undefined,
): Promise<TeacherContact | null> {
  if (!teacherKey) return null;

  // Prefer teachers row by id
  const { data: byId } = await supabase
    .from('teachers')
    .select('id, profile_id, profiles(id, full_name, phone, email)')
    .eq('id', teacherKey)
    .limit(1);

  if (byId?.[0]) {
    const p = relationOne(byId[0].profiles as any);
    return profileToTeacher(byId[0].id, p);
  }

  // Fallback: teacher_id might be profile id
  const { data: byProfile } = await supabase
    .from('teachers')
    .select('id, profile_id, profiles(id, full_name, phone, email)')
    .eq('profile_id', teacherKey)
    .limit(1);

  if (byProfile?.[0]) {
    const p = relationOne(byProfile[0].profiles as any);
    return profileToTeacher(byProfile[0].id, p);
  }

  // Last resort: treat key as profile id
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email')
    .eq('id', teacherKey)
    .limit(1);

  if (profileRows?.[0]) {
    return profileToTeacher(null, profileRows[0]);
  }

  return null;
}

/** Load student enrollment + assigned teacher (name, phone, email). */
export async function getStudentContext(profileId: string): Promise<StudentContext | null> {
  let studentRows: any[] | null = null;
  let error: { message: string } | null = null;

  const withGender = await supabase
    .from('students')
    .select(
      'id, batch_id, course_id, application_id, gender, courses(name), batches(id, name, teacher_id, course_id)',
    )
    .eq('profile_id', profileId)
    .limit(1);

  if (withGender.error) {
    const fallback = await supabase
      .from('students')
      .select(
        'id, batch_id, course_id, application_id, courses(name), batches(id, name, teacher_id, course_id)',
      )
      .eq('profile_id', profileId)
      .limit(1);
    studentRows = fallback.data;
    error = fallback.error;
  } else {
    studentRows = withGender.data;
  }

  if (error || !studentRows?.[0]) return null;

  const s = studentRows[0];
  const batch = relationOne(s.batches as any);
  const course = relationOne(s.courses as any);

  let teacher: TeacherContact | null = null;
  if (batch?.teacher_id) {
    teacher = await resolveTeacherContact(batch.teacher_id);
  }

  // Fallback: decode tid:{teacherId}| from batch name
  if (!teacher && batch?.name) {
    const m = String(batch.name).match(/^tid:([a-f0-9-]+)\|/i);
    if (m?.[1]) teacher = await resolveTeacherContact(m[1]);
  }

  // Fallback: course's teacher via teacher_courses matching student gender
  const courseId = s.course_id || batch?.course_id || null;
  if (!teacher && courseId) {
    const studentGender = resolveStudentGender({
      gender: s.gender,
      batchName: batch?.name,
    });
    let tcRows: any[] | null = null;
    const withScope = await supabase
      .from('teacher_courses')
      .select('teacher_id, gender_scope')
      .eq('course_id', courseId);
    if (withScope.error) {
      const fallback = await supabase
        .from('teacher_courses')
        .select('teacher_id')
        .eq('course_id', courseId)
        .limit(1);
      tcRows = fallback.data;
    } else {
      tcRows = (withScope.data ?? []).filter((row) => {
        const scope = String(row.gender_scope || 'Both');
        if (scope === 'Both') return true;
        if (studentGender === 'Unknown') return scope === 'Both';
        return scope === studentGender || scope === 'Both';
      });
      if (!tcRows.length) tcRows = withScope.data;
    }
    if (tcRows?.[0]?.teacher_id) {
      teacher = await resolveTeacherContact(tcRows[0].teacher_id);
    }
  }

  return {
    studentId: s.id,
    batchId: s.batch_id ?? null,
    courseId,
    applicationId: s.application_id ?? null,
    gender: s.gender ?? null,
    courseName: course?.name || '—',
    batchName: cleanBatchDisplayName(batch?.name),
    teacher,
  };
}

export function teacherLabel(teacher: TeacherContact | null | undefined): string {
  if (!teacher) return 'Not assigned';
  return teacher.fullName !== '—' ? teacher.fullName : 'Not assigned';
}

export { EMPTY_TEACHER, cleanBatchDisplayName };

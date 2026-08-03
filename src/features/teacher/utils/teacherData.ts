import { supabase } from '@/lib/supabase';
import { generateUniqueApplicationId } from '@/lib/applicationId';

export type BatchRow = {
  id: string;
  name?: string | null;
  batch_name?: string | null;
  title?: string | null;
  course_id?: string | null;
  teacher_id?: string | null;
  timing?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  display_name?: string;
};

/** Who this teacher is allowed to teach for their assigned course. */
export type GenderScope = 'Male' | 'Female' | 'Both';

/** Normalize PostgREST many-to-one embeds (object or single-element array). */
export function relationOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export function normalizeBatchLabel(batch: BatchRow): string {
  return batch.name || batch.batch_name || batch.title || `Batch ${batch.id.slice(0, 6)}`;
}

export function cleanBatchDisplayName(name?: string | null): string {
  return (name || '').replace(/^tid:[a-f0-9-]+\|/i, '') || '—';
}

/** Detect Male/Female from batch name or stored gender. */
export function resolveStudentGender(opts: {
  gender?: string | null;
  batchName?: string | null;
}): 'Male' | 'Female' | 'Unknown' {
  const g = String(opts.gender || '').trim().toLowerCase();
  if (g === 'male') return 'Male';
  if (g === 'female') return 'Female';

  const batch = cleanBatchDisplayName(opts.batchName).toLowerCase();
  if (/\bfemale\b/.test(batch)) return 'Female';
  if (/\bmale\b/.test(batch)) return 'Male';
  return 'Unknown';
}

export function normalizeGenderScope(value?: string | null): GenderScope {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'male') return 'Male';
  if (v === 'female') return 'Female';
  if (v === 'both') return 'Both';
  // Invalid / empty — callers should treat as "not set"
  return 'Both';
}

/** Parse DB value; empty/null means gender not chosen yet (show no students). */
export function parseGenderScope(value?: string | null): GenderScope | null {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'male') return 'Male';
  if (v === 'female') return 'Female';
  if (v === 'both') return 'Both';
  return null;
}

/** True if two gender scopes would overlap the same students. */
export function genderScopesConflict(a: GenderScope, b: GenderScope): boolean {
  if (a === 'Both' || b === 'Both') return true;
  return a === b;
}

export function studentMatchesGenderScope(
  studentGender: 'Male' | 'Female' | 'Unknown',
  scope: GenderScope | null,
): boolean {
  // No Male/Female/Both selected → teacher sees nobody
  if (!scope) return false;
  if (scope === 'Both') return true;
  if (studentGender === 'Unknown') return false;
  return studentGender === scope;
}

/** Resolve teachers table row id for an auth user (profile_id). */
export async function getTeacherEntityId(authUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', authUserId)
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Batches assigned to this teacher.
 * Supports:
 * - batches.teacher_id = teachers.id OR profiles.id
 * - fallback name prefix "tid:{teacherId}|" when teacher_id column is missing
 */
export async function getTeacherBatches(
  authUserId: string,
): Promise<(BatchRow & { display_name: string })[]> {
  const teacherEntityId = await getTeacherEntityId(authUserId);
  const teacherKeys = [authUserId, teacherEntityId].filter(Boolean) as string[];

  if (teacherKeys.length === 0) return [];

  const byId = await supabase.from('batches').select('*').in('teacher_id', teacherKeys);

  let rows: BatchRow[] = [];
  if (!byId.error) {
    rows = (byId.data ?? []) as BatchRow[];
  }

  if (teacherEntityId) {
    const { data: named } = await supabase
      .from('batches')
      .select('*')
      .ilike('name', `tid:${teacherEntityId}|%`);
    for (const row of (named ?? []) as BatchRow[]) {
      if (!rows.some((r) => r.id === row.id)) rows.push(row);
    }
  }

  return rows.map((row) => ({
    ...row,
    display_name: normalizeBatchLabel(row).replace(/^tid:[a-f0-9-]+\|/i, ''),
  }));
}

/** Ensure a teachers row exists; optional fields are applied on insert or update. */
export async function ensureTeacherRow(
  profileId: string,
  specialization = 'General',
  extras?: Record<string, string | null | undefined>,
) {
  const { data: existing } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', profileId)
    .limit(1);

  const cleanExtras: Record<string, string | null> = {};
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (key === 'profile_id' || key === 'id') continue;
      if (value === undefined) continue;
      cleanExtras[key] = value;
    }
  }

  if (existing?.[0]?.id) {
    if (Object.keys(cleanExtras).length > 0) {
      const { error } = await supabase
        .from('teachers')
        .update({ specialization, ...cleanExtras })
        .eq('id', existing[0].id);
      if (error) throw error;
    }
    return existing[0].id;
  }

  const { data, error } = await supabase
    .from('teachers')
    .insert({
      profile_id: profileId,
      specialization,
      ...cleanExtras,
    })
    .select('id')
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/** Ensure a students row exists for an approved student profile. */
export async function ensureStudentRow(
  profileId: string,
  extras?: {
    course_id?: string | null;
    batch_id?: string | null;
    application_id?: string | null;
  },
) {
  const { data: existing } = await supabase
    .from('students')
    .select('id, course_id, application_id')
    .eq('profile_id', profileId)
    .limit(1);

  if (existing?.[0]?.id) {
    const patch: Record<string, unknown> = {};
    if (extras?.course_id && !existing[0].course_id) patch.course_id = extras.course_id;
    if (extras?.batch_id) patch.batch_id = extras.batch_id;
    if (extras?.application_id?.trim() && !existing[0].application_id) {
      patch.application_id = extras.application_id.trim();
    } else if (!existing[0].application_id && !extras?.application_id) {
      patch.application_id = await generateUniqueApplicationId();
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('students').update(patch).eq('id', existing[0].id);
    }
    return existing[0].id;
  }

  const applicationId =
    extras?.application_id?.trim() || (await generateUniqueApplicationId());

  const { data, error } = await supabase
    .from('students')
    .insert({
      profile_id: profileId,
      enrollment_date: new Date().toISOString().slice(0, 10),
      application_id: applicationId,
      ...(extras?.course_id ? { course_id: extras.course_id } : {}),
      ...(extras?.batch_id ? { batch_id: extras.batch_id } : {}),
    })
    .select('id')
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/** Course IDs assigned to this teacher (via teacher_courses). */
export async function getTeacherCourseIds(authUserId: string): Promise<string[]> {
  const teacherEntityId = await getTeacherEntityId(authUserId);
  if (!teacherEntityId) return [];

  const { data, error } = await supabase
    .from('teacher_courses')
    .select('course_id')
    .eq('teacher_id', teacherEntityId);

  if (error) return [];
  return (data ?? []).map((r) => r.course_id).filter(Boolean);
}

/** Primary assigned course + gender scope for this teacher. */
export async function getTeacherAssignedCourse(
  authUserId: string,
): Promise<
  | {
      id: string;
      name: string;
      description?: string | null;
      genderScope: GenderScope | null;
    }
  | null
> {
  const teacherEntityId = await getTeacherEntityId(authUserId);
  if (!teacherEntityId) return null;

  let data: any[] | null = null;
  let error: { message: string } | null = null;

  const withScope = await supabase
    .from('teacher_courses')
    .select('course_id, gender_scope, courses(id, name)')
    .eq('teacher_id', teacherEntityId)
    .limit(1);

  if (withScope.error) {
    const fallback = await supabase
      .from('teacher_courses')
      .select('course_id, courses(id, name)')
      .eq('teacher_id', teacherEntityId)
      .limit(1);
    data = fallback.data;
    error = fallback.error;
  } else {
    data = withScope.data;
  }

  if (!error && data?.[0]) {
    const course = relationOne<{ id: string; name: string; description?: string | null }>(
      data[0].courses,
    );
    if (course?.id) {
      return {
        id: course.id,
        name: course.name,
        description: null,
        genderScope: parseGenderScope(data[0].gender_scope),
      };
    }
  }

  // Fallback: Infer course from assigned batches in 'batches' table
  const teacherKeys = [authUserId, teacherEntityId].filter(Boolean) as string[];
  const { data: batchData } = await supabase
    .from('batches')
    .select('course_id, name, courses(id, name, description)')
    .in('teacher_id', teacherKeys)
    .not('course_id', 'is', null);

  if (batchData && batchData.length > 0) {
    const firstCourse = relationOne<{ id: string; name: string; description?: string | null }>(
      batchData[0].courses,
    );

    if (firstCourse?.id) {
      // Determine overall gender scope from assigned batch names
      let hasFemale = false;
      let hasMale = false;
      for (const b of batchData) {
        const bName = cleanBatchDisplayName(b.name).toLowerCase();
        if (/\bfemale\b/.test(bName)) hasFemale = true;
        else if (/\bmale\b/.test(bName)) hasMale = true;
        else {
          hasFemale = true;
          hasMale = true;
        }
      }
      const derivedScope: GenderScope =
        hasFemale && hasMale ? 'Both' : hasFemale ? 'Female' : hasMale ? 'Male' : 'Both';

      return {
        id: firstCourse.id,
        name: firstCourse.name,
        description: firstCourse.description || null,
        genderScope: derivedScope,
      };
    }
  }

  return null;
}

/** Sync teacher_courses entry when assigning a teacher to a batch. */
export async function syncTeacherBatchAssignment(teacherId: string | null, courseId: string) {
  if (!teacherId || !courseId) return;
  try {
    const { data } = await supabase
      .from('teacher_courses')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('course_id', courseId)
      .limit(1);

    if (!data || data.length === 0) {
      await supabase.from('teacher_courses').insert({
        teacher_id: teacherId,
        course_id: courseId,
        gender_scope: 'Both',
      });
    }
  } catch (err) {
    console.warn('Sync teacher_courses notice:', err);
  }
}


/**
 * Students visible to a teacher:
 * - students in batches owned by this teacher, OR
 * - unassigned students (no batch) with course_id matching teacher's course
 * Then filtered by gender_scope (Male / Female / Both).
 * If gender_scope not set → empty list.
 * If no course → empty list.
 */
export async function getTeacherVisibleStudentFilter(authUserId: string) {
  const assignment = await getTeacherAssignedCourse(authUserId);
  if (!assignment) {
    return { courseIds: [] as string[], batchIds: [] as string[], genderScope: null as GenderScope | null };
  }

  const courseIds = [assignment.id];
  const batches = await getTeacherBatches(authUserId);
  const batchIds = batches.map((b) => b.id);

  return {
    courseIds,
    batchIds,
    genderScope: assignment.genderScope,
  };
}

/** Fetch students this teacher is allowed to manage. */
export async function getTeacherStudents<T = Record<string, unknown>>(
  authUserId: string,
  select = `
    id,
    batch_id,
    course_id,
    application_id,
    gender,
    profiles ( full_name, email ),
    batches ( id, name ),
    courses ( id, name )
  `,
): Promise<T[]> {
  const { courseIds, batchIds, genderScope } = await getTeacherVisibleStudentFilter(authUserId);
  // No course, or gender not chosen → show nobody
  if (courseIds.length === 0 || !genderScope) return [];
  if (batchIds.length === 0 && courseIds.length === 0) return [];

  const parts: string[] = [];
  if (batchIds.length > 0) parts.push(`batch_id.in.(${batchIds.join(',')})`);
  if (courseIds.length > 0) {
    parts.push(`and(course_id.in.(${courseIds.join(',')}),batch_id.is.null)`);
  }
  if (parts.length === 0) return [];

  let data: any[] | null = null;
  let error: { message: string } | null = null;

  const primary = await supabase.from('students').select(select).or(parts.join(','));
  if (primary.error && /gender/i.test(primary.error.message)) {
    const withoutGender = select
      .replace(/,?\s*gender\s*,?/i, ',')
      .replace(/,,/g, ',')
      .replace(/,\s*$/, '');
    const fallback = await supabase.from('students').select(withoutGender).or(parts.join(','));
    data = fallback.data;
    error = fallback.error;
  } else {
    data = primary.data;
    error = primary.error;
  }

  if (error) throw error;

  return (data ?? []).filter((row: any) => {
    const gender = resolveStudentGender({
      gender: row.gender,
      batchName: relationOne(row.batches)?.name,
    });
    return studentMatchesGenderScope(gender, genderScope);
  }) as T[];
}

export type SetAssignmentOptions = {
  /** Auto-fix overlapping teachers on the same course so change succeeds. */
  resolveConflicts?: boolean;
};

/**
 * Assign one course + gender scope, or clear (no course).
 * genderScope null with a courseId = course assigned but teaches nobody until set.
 * With resolveConflicts: adjusts other teachers automatically (safe later changes).
 */
export async function setTeacherCourseAssignment(
  teacherId: string,
  courseId: string | null,
  genderScope: GenderScope | null = 'Both',
  options: SetAssignmentOptions = {},
) {
  const { error: delError } = await supabase
    .from('teacher_courses')
    .delete()
    .eq('teacher_id', teacherId);
  if (delError) throw delError;

  if (!courseId) return;

  const scope = genderScope ? normalizeGenderScope(genderScope) : null;

  const withScope = await supabase
    .from('teacher_courses')
    .select('id, teacher_id, gender_scope')
    .eq('course_id', courseId)
    .neq('teacher_id', teacherId);

  if (withScope.error) {
    const fallback = await supabase
      .from('teacher_courses')
      .select('id, teacher_id')
      .eq('course_id', courseId)
      .neq('teacher_id', teacherId);
    if (fallback.error) throw fallback.error;
    if ((fallback.data ?? []).length > 0 && scope) {
      if (!options.resolveConflicts) {
        throw new Error(
          'This course is already assigned to another teacher. Confirm to auto-adjust, or clear that teacher first.',
        );
      }
      for (const row of fallback.data ?? []) {
        await supabase.from('teacher_courses').delete().eq('id', row.id);
      }
    }
  } else if (scope) {
    const conflicts = (withScope.data ?? []).filter((row) =>
      genderScopesConflict(scope, normalizeGenderScope(row.gender_scope)),
    );

    if (conflicts.length > 0) {
      if (!options.resolveConflicts) {
        throw new Error(
          `CONFLICT:${scope}:Course already has overlapping class gender. Save again after confirm to auto-adjust other teachers.`,
        );
      }

      for (const row of conflicts) {
        const other = parseGenderScope(row.gender_scope) || normalizeGenderScope(row.gender_scope);

        // Taking Both → other teacher loses this course
        if (scope === 'Both') {
          await supabase.from('teacher_courses').delete().eq('id', row.id);
          continue;
        }

        // Other has Both → shrink them to the opposite gender
        if (other === 'Both') {
          const leftover: GenderScope = scope === 'Male' ? 'Female' : 'Male';
          await supabase
            .from('teacher_courses')
            .update({ gender_scope: leftover })
            .eq('id', row.id);
          continue;
        }

        // Same gender (Male/Male or Female/Female) → remove other from course
        if (other === scope) {
          await supabase.from('teacher_courses').delete().eq('id', row.id);
        }
      }
    }
  }

  const insertBody: Record<string, string | null> = {
    teacher_id: teacherId,
    course_id: courseId,
    gender_scope: scope,
  };

  const { error: insError } = await supabase.from('teacher_courses').insert(insertBody);

  if (insError) {
    if (/gender_scope/i.test(insError.message) || /null value/i.test(insError.message)) {
      // Column missing or NOT NULL — insert course only / with Both
      const { error: plainErr } = await supabase.from('teacher_courses').insert({
        teacher_id: teacherId,
        course_id: courseId,
        ...(scope ? { gender_scope: scope } : {}),
      });
      if (plainErr) {
        // last resort without gender_scope field
        const { error: bare } = await supabase
          .from('teacher_courses')
          .insert({ teacher_id: teacherId, course_id: courseId });
        if (bare) throw bare;
        if (!scope) return;
        throw new Error(
          'Course saved. Run add_teacher_gender_scope.sql (allow null gender_scope) for class gender.',
        );
      }
      return;
    }
    throw insError;
  }
}

/** Replace a teacher's course assignment (exactly one course). Defaults gender to Both. */
export async function setTeacherCourses(teacherId: string, courseIds: string[]) {
  return setTeacherCourseAssignment(teacherId, courseIds[0] ?? null, 'Both');
}

/** Assign one course to a teacher (alias). */
export async function setTeacherCourse(teacherId: string, courseId: string | null) {
  return setTeacherCourseAssignment(teacherId, courseId, courseId ? 'Both' : null);
}


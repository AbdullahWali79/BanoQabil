import { supabase } from '@/lib/supabase';

/** Same length as existing IDs (e.g. 3117830). */
export const APPLICATION_ID_LENGTH = 7;

const FALLBACK_START = 3117829;

/** Returns error message, or null if format is valid (exactly 7 digits). */
export function validateApplicationIdFormat(applicationId: string): string | null {
  const id = applicationId.trim();
  if (!id) return 'Application ID is required.';
  if (!/^\d+$/.test(id)) return 'Application ID must be digits only.';
  if (id.length !== APPLICATION_ID_LENGTH) {
    return `Application ID must be exactly ${APPLICATION_ID_LENGTH} digits.`;
  }
  return null;
}

function asSevenDigitId(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== APPLICATION_ID_LENGTH) return null;
  return digits;
}

async function nextFromSevenDigitMax(): Promise<string> {
  const { data: rows } = await supabase
    .from('students')
    .select('application_id')
    .not('application_id', 'is', null);

  let max = FALLBACK_START;
  for (const row of rows ?? []) {
    const id = asSevenDigitId(row.application_id);
    if (!id) continue;
    const n = Number(id);
    if (Number.isFinite(n) && n > max) max = n;
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const next = max + 1 + attempt;
    if (next > 9999999) break;
    const candidate = String(next).padStart(APPLICATION_ID_LENGTH, '0');
    if (candidate.length !== APPLICATION_ID_LENGTH) continue;
    const taken = await isApplicationIdTaken(candidate);
    if (!taken) return candidate;
  }

  throw new Error('Could not generate a unique 7-digit Application ID. Try again.');
}

/** Generate next unique Application ID (exactly 7 digits, e.g. 3117830). */
export async function generateUniqueApplicationId(): Promise<string> {
  // Prefer DB RPC, but ignore results that are not exactly 7 digits
  // (older DBs may have longer numeric IDs that inflate max+1).
  try {
    const { data, error } = await supabase.rpc('next_application_id');
    if (!error && data != null) {
      const id = asSevenDigitId(data);
      if (id) {
        const taken = await isApplicationIdTaken(id);
        if (!taken) return id;
      }
    }
  } catch {
    // fall through to client generator
  }

  return nextFromSevenDigitMax();
}

/** True if another student already uses this Application ID. */
export async function isApplicationIdTaken(
  applicationId: string,
  excludeStudentId?: string | null,
): Promise<boolean> {
  const id = applicationId.trim();
  if (!id) return false;

  let query = supabase.from('students').select('id').eq('application_id', id).limit(2);

  if (excludeStudentId) {
    query = query.neq('id', excludeStudentId);
  }

  const { data, error } = await query;
  if (error) {
    const { data: all } = await supabase
      .from('students')
      .select('id, application_id')
      .not('application_id', 'is', null);
    return (all ?? []).some(
      (r) =>
        String(r.application_id ?? '').trim().toLowerCase() === id.toLowerCase() &&
        r.id !== excludeStudentId,
    );
  }

  return (data?.length ?? 0) > 0;
}

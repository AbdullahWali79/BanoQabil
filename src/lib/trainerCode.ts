import { supabase } from '@/lib/supabase';

/** Same length as student Application IDs (e.g. 5210001). */
export const TRAINER_CODE_LENGTH = 7;

/** Separate range from student Application IDs (~3117xxx). */
const FALLBACK_START = 5209999;

/** Returns error message, or null if format is valid (exactly 7 digits). */
export function validateTrainerCodeFormat(trainerCode: string): string | null {
  const id = trainerCode.trim();
  if (!id) return 'Trainer Code is required.';
  if (!/^\d+$/.test(id)) return 'Trainer Code must be digits only.';
  if (id.length !== TRAINER_CODE_LENGTH) {
    return `Trainer Code must be exactly ${TRAINER_CODE_LENGTH} digits.`;
  }
  return null;
}

function asSevenDigitId(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== TRAINER_CODE_LENGTH) return null;
  return digits;
}

export function isValidTrainerCode(raw: unknown): boolean {
  return asSevenDigitId(raw) != null;
}

async function nextFromSevenDigitMax(): Promise<string> {
  const { data: rows } = await supabase
    .from('teachers')
    .select('trainer_code')
    .not('trainer_code', 'is', null);

  let max = FALLBACK_START;
  for (const row of rows ?? []) {
    const id = asSevenDigitId(row.trainer_code);
    if (!id) continue;
    const n = Number(id);
    if (Number.isFinite(n) && n > max) max = n;
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const next = max + 1 + attempt;
    if (next > 9999999) break;
    const candidate = String(next).padStart(TRAINER_CODE_LENGTH, '0');
    if (candidate.length !== TRAINER_CODE_LENGTH) continue;
    const taken = await isTrainerCodeTaken(candidate);
    if (!taken) return candidate;
  }

  throw new Error('Could not generate a unique Trainer Code. Try again.');
}

/** Generate next unique Trainer Code (exactly 7 digits). */
export async function generateUniqueTrainerCode(): Promise<string> {
  return nextFromSevenDigitMax();
}

/** True if another teacher already uses this Trainer Code. */
export async function isTrainerCodeTaken(
  trainerCode: string,
  excludeTeacherId?: string | null,
): Promise<boolean> {
  const id = trainerCode.trim();
  if (!id) return false;

  let query = supabase.from('teachers').select('id').eq('trainer_code', id).limit(2);

  if (excludeTeacherId) {
    query = query.neq('id', excludeTeacherId);
  }

  const { data, error } = await query;
  if (error) {
    const { data: all } = await supabase
      .from('teachers')
      .select('id, trainer_code')
      .not('trainer_code', 'is', null);
    return (all ?? []).some(
      (r) =>
        String(r.trainer_code ?? '').trim() === id && r.id !== excludeTeacherId,
    );
  }

  return (data?.length ?? 0) > 0;
}

/** True if another teacher already uses this username (case-insensitive). */
export async function isUsernameTaken(
  username: string,
  excludeTeacherId?: string | null,
): Promise<boolean> {
  const name = username.trim().toLowerCase();
  if (!name) return false;

  const { data: all } = await supabase
    .from('teachers')
    .select('id, username')
    .not('username', 'is', null);

  return (all ?? []).some(
    (r) =>
      String(r.username ?? '').trim().toLowerCase() === name &&
      r.id !== excludeTeacherId,
  );
}

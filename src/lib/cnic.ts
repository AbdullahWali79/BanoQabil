/** Pakistan CNIC / Form-B: exactly 13 digits (no dashes). */
export const CNIC_LENGTH = 13;

/** Strip to digits only. */
export function normalizeCnic(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Digits only, capped at CNIC_LENGTH (for controlled inputs). */
export function sanitizeCnicInput(value: string): string {
  return normalizeCnic(value).slice(0, CNIC_LENGTH);
}

/**
 * Returns error message, or null if valid.
 * Accepts digits with or without dashes; stored value should be digits-only.
 */
export function validateCnic(value: string): string | null {
  const digits = normalizeCnic(value);
  if (!digits) return 'CNIC / Form-B is required.';
  if (digits.length !== CNIC_LENGTH) {
    return `CNIC / Form-B must be exactly ${CNIC_LENGTH} digits.`;
  }
  return null;
}

/** Display helper: 12345-1234567-1 */
export function formatCnicDisplay(value: string): string {
  const d = normalizeCnic(value);
  if (d.length !== CNIC_LENGTH) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

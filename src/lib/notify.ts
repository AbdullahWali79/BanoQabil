import { toast } from 'sonner';
import { formatAppError } from '@/lib/appError';

/** Keep toast copy short and readable. */
const MAX_LEN = 72;

const toastOpts = {
  duration: 3200,
} as const;

function short(message: string, max = MAX_LEN): string {
  const text = message.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Success toast — short human message. */
export function toastSuccess(message: string) {
  toast.success(short(message), toastOpts);
}

/** Info toast. */
export function toastInfo(message: string) {
  toast.message(short(message), toastOpts);
}

/** Warning toast. */
export function toastWarning(message: string) {
  toast.warning(short(message), toastOpts);
}

/**
 * Error toast — always runs through formatAppError so internals stay hidden.
 * Pass a plain string for validation messages, or an Error/Supabase error object.
 */
export function toastError(err: unknown, fallback = 'Something went wrong.') {
  const text =
    typeof err === 'string' && err.trim() && !/[{[]/.test(err)
      ? formatAppError(err, err.trim())
      : formatAppError(err, fallback);
  toast.error(short(text), { ...toastOpts, duration: 4200 });
  return text;
}

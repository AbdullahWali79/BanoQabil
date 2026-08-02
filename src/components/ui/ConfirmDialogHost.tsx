import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  resolveConfirm,
  subscribeConfirm,
  type ConfirmState,
  type ConfirmTone,
} from '@/lib/confirmDialog';

function toneStyles(tone: ConfirmTone) {
  if (tone === 'warning') {
    return {
      bar: 'from-amber-500 to-orange-500',
      iconWrap: 'bg-amber-50 text-amber-700 ring-amber-200',
      confirm: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500',
      soft: 'bg-amber-50/80 border-amber-100',
      Icon: AlertTriangle,
    };
  }
  if (tone === 'default') {
    return {
      bar: 'from-sky-500 to-blue-600',
      iconWrap: 'bg-sky-50 text-sky-700 ring-sky-200',
      confirm: 'bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500',
      soft: 'bg-sky-50/80 border-sky-100',
      Icon: HelpCircle,
    };
  }
  return {
    bar: 'from-rose-500 to-red-600',
    iconWrap: 'bg-rose-50 text-rose-700 ring-rose-200',
    confirm: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
    soft: 'bg-rose-50/80 border-rose-100',
    Icon: Trash2,
  };
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => subscribeConfirm(setState), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
      if (e.key === 'Enter') resolveConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;

  const tone = state.tone ?? 'danger';
  const styles = toneStyles(tone);
  const Icon = styles.Icon;
  const [titleLine, ...restLines] = (state.description || 'Are you sure you want to continue?')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const bodyLines = restLines.join('\n').trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resolveConfirm(false);
      }}
    >
      <div className="w-full max-w-[26rem] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80">
        <div className={`h-1.5 w-full bg-gradient-to-r ${styles.bar}`} />

        <div className="p-5 sm:p-6">
          <div className="flex gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.iconWrap}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Please confirm
              </p>
              <h2
                id="confirm-dialog-title"
                className="mt-1 text-lg font-bold tracking-tight text-slate-900"
              >
                {state.title}
              </h2>
            </div>
          </div>

          <div className={`mt-4 rounded-xl border px-4 py-3 ${styles.soft}`}>
            <p className="text-sm font-medium leading-relaxed text-slate-800">{titleLine}</p>
            {bodyLines ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {bodyLines}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 sm:min-w-[7.5rem]"
              onClick={() => resolveConfirm(false)}
            >
              {state.cancelLabel || 'Cancel'}
            </Button>
            <Button
              type="button"
              className={`h-10 sm:min-w-[8.5rem] ${styles.confirm}`}
              onClick={() => resolveConfirm(true)}
              autoFocus
            >
              {state.confirmLabel || 'Yes, continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

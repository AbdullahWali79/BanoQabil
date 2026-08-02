export type ConfirmTone = 'danger' | 'warning' | 'default';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

export type ConfirmState = ConfirmOptions & { open: true };

type Listener = (state: ConfirmState | null) => void;

let listeners: Listener[] = [];
let current: ConfirmState | null = null;
let resolver: ((value: boolean) => void) | null = null;

function emit(state: ConfirmState | null) {
  current = state;
  for (const l of listeners) l(state);
}

export function subscribeConfirm(listener: Listener) {
  listeners.push(listener);
  listener(current);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function resolveConfirm(value: boolean) {
  const r = resolver;
  resolver = null;
  emit(null);
  r?.(value);
}

/** Styled “Are you sure?” dialog — replaces window.confirm. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // If a dialog is already open, close it as cancel first
  if (resolver) resolveConfirm(false);

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
    emit({
      open: true,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Yes, continue',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? 'danger',
    });
  });
}

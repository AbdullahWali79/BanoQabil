import { Toaster } from 'sonner';

/** Global toast host — compact, human-friendly notifications. */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={3}
      gap={8}
      offset={{ top: 72, right: 12 }}
      mobileOffset={{ top: 72, right: 12 }}
      toastOptions={{
        duration: 3200,
        classNames: {
          toast:
            'group toast !min-h-0 !w-auto !max-w-[min(20rem,calc(100vw-1.5rem))] !rounded-lg !border !px-3 !py-2 !shadow-md font-sans text-[13px] leading-snug',
          title: '!text-[13px] !font-medium !leading-snug',
          description: '!text-xs !opacity-90',
          actionButton: '!text-xs',
          cancelButton: '!text-xs',
          closeButton: '!scale-90',
          success: '!border-emerald-200',
          error: '!border-red-200',
          warning: '!border-amber-200',
        },
      }}
    />
  );
}

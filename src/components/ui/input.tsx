import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, autoComplete, readOnly, onFocus, onBlur, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [autofillUnlocked, setAutofillUnlocked] = React.useState(false);
    const isPassword = type === "password";

    // Login uses current-password — allow browser save/fill there.
    // Admin "set new password" fields must stay empty (Chrome injects strong passwords).
    const allowBrowserAutofill =
      autoComplete === "current-password" ||
      autoComplete === "username" ||
      autoComplete === "email";

    const blockPasswordAutofill = isPassword && !allowBrowserAutofill;
    const resolvedAutoComplete =
      autoComplete ?? (isPassword ? "new-password" : undefined);

    return (
      <div className="relative w-full">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            isPassword && "pr-10",
            className
          )}
          ref={ref}
          autoComplete={resolvedAutoComplete}
          readOnly={readOnly ?? (blockPasswordAutofill && !autofillUnlocked)}
          onFocus={(e) => {
            if (blockPasswordAutofill) setAutofillUnlocked(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            // Re-lock empty fields so reopening a modal does not get autofilled
            if (blockPasswordAutofill && !e.currentTarget.value) {
              setAutofillUnlocked(false);
            }
            onBlur?.(e);
          }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              setShowPassword(!showPassword);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }

import { forwardRef } from "react";

export const Textarea = forwardRef(function Textarea(
  { className = "", error, helperText, label, id, ...props },
  ref
) {
  const textareaId = id || props.name || label?.toLowerCase()?.replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="w-full">
      {label && <label htmlFor={textareaId} className="mb-1.5 block text-sm font-semibold text-text-primary">{label}</label>}
      <textarea
        ref={ref}
        id={textareaId}
        className={`w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-danger focus:ring-danger" : ""} ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        {...props}
      />
      {helperText && !error && <p id={`${textareaId}-helper`} className="mt-1.5 text-xs leading-5 text-text-secondary">{helperText}</p>}
      {error && <p id={`${textareaId}-error`} className="mt-1 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
});

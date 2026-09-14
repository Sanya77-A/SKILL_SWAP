import { forwardRef } from "react";

export const Input = forwardRef(
  ({ className = "", error, helperText, label, id, ...props }, ref) => {
    const inputId = id || props.name || label?.toLowerCase()?.replace(/\s/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5
            text-text-primary placeholder:text-text-secondary
            focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30
            transition-[border-color,box-shadow,background-color] duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-danger focus:ring-danger" : ""}
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {helperText && !error && <p id={`${inputId}-helper`} className="mt-1.5 text-xs leading-5 text-text-secondary">{helperText}</p>}
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

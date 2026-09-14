import { forwardRef } from "react";

export const Select = forwardRef(
  ({ className = "", error, helperText, label, id, options = [], placeholder, ...props }, ref) => {
    const selectId = id || props.name || label?.toLowerCase()?.replace(/\s/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-text-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5
            text-text-primary
            focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30
            transition-[border-color,box-shadow,background-color] duration-200
            disabled:opacity-50
            ${error ? "border-danger" : ""}
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
        {helperText && !error && <p id={`${selectId}-helper`} className="mt-1.5 text-xs leading-5 text-text-secondary">{helperText}</p>}
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-sm text-danger" role="alert">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

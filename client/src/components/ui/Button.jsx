import { forwardRef, cloneElement, isValidElement } from "react";

const variants = {
  primary: "border border-accent bg-accent text-on-accent shadow-soft hover:border-accent-hover hover:bg-accent-hover",
  secondary: "border border-border bg-surface-2 text-text-primary hover:border-accent/40 hover:bg-surface",
  ghost: "border border-transparent text-text-primary hover:bg-surface-2",
  danger: "bg-danger/90 hover:bg-danger text-on-accent",
  success: "border border-accent-2 bg-accent-2 text-on-accent hover:brightness-95",
};

const sizes = {
  sm: "min-h-8 px-3 py-1.5 text-sm rounded-lg",
  md: "min-h-10 px-4 py-2 text-sm rounded-[10px]",
  lg: "min-h-12 px-6 py-3 text-base rounded-xl",
};

const baseClass = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const Button = forwardRef(function Button(
  { className = "", variant = "primary", size = "md", children, disabled, asChild, ...props },
  ref
) {
  const combined = `${baseClass} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;
  if (asChild && isValidElement(children)) {
    return cloneElement(children, { className: combined, ...props });
  }
  return (
    <button ref={ref} disabled={disabled} className={combined} {...props}>
      {children}
    </button>
  );
});

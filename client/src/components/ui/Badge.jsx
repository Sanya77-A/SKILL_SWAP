const variants = {
  default: "bg-surface-2 text-text-secondary border-border",
  accent: "bg-accent/20 text-accent border-accent/30",
  success: "bg-accent-2/20 text-accent-2 border-accent-2/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  danger: "bg-danger/20 text-danger border-danger/30",
};

export function Badge({ children, variant = "default", className = "", ...props }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold leading-none
        ${variants[variant] || variants.default}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

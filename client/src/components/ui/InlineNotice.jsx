import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const variants = {
  info: { icon: Info, className: "border-accent/25 bg-accent/10 text-accent" },
  success: { icon: CircleCheck, className: "border-accent-2/25 bg-accent-2/10 text-accent-2" },
  warning: { icon: TriangleAlert, className: "border-warning/25 bg-warning/10 text-warning" },
  danger: { icon: CircleAlert, className: "border-danger/25 bg-danger/10 text-danger" },
};

export function InlineNotice({ title, children, variant = "info", className = "" }) {
  const selected = variants[variant] || variants.info;
  const Icon = selected.icon;
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${selected.className} ${className}`} role={variant === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="mt-0.5 text-sm leading-6 text-text-secondary">{children}</div>}
      </div>
    </div>
  );
}

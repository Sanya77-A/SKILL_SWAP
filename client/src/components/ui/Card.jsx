export function Card({ className = "", children, hover = false, ...props }) {
  return (
    <div
      className={`
        rounded-2xl border border-border bg-surface shadow-soft
        ${hover ? "surface-hover hover:-translate-y-0.5" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`border-b border-border px-5 py-4 sm:px-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div className={`flex items-center gap-2 border-t border-border px-5 py-4 sm:px-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

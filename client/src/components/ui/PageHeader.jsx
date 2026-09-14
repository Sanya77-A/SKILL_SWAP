export function PageHeader({ icon: Icon, title, description, actions, className = "" }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <h1 className="page-title">{title}</h1>
        </div>
        {description && <p className={`page-description ${Icon ? "sm:pl-[3.25rem]" : ""}`}>{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

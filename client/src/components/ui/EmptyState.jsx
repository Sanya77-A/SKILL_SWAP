import { Card, CardContent } from "./Card";
import { Button } from "./Button";

export function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-14">
        {Icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        <h2 className="mt-4 font-heading text-lg font-semibold text-text-primary">{title}</h2>
        {description && <p className="mt-1 max-w-md text-sm leading-6 text-text-secondary">{description}</p>}
        {action && <Button className="mt-5" {...action.props}>{action.label}</Button>}
      </CardContent>
    </Card>
  );
}

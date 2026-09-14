import { BadgeCheck, Repeat2, ShieldCheck } from "lucide-react";

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft lg:flex-row">
      <div className="hidden flex-col justify-between border-r border-border bg-surface-2 px-12 py-14 lg:flex lg:w-[46%] xl:px-16">
        <div className="max-w-md">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
            <Repeat2 className="h-6 w-6 text-accent" />
          </div>
          <h2 className="mb-4 font-heading text-3xl font-bold text-text-primary">
            Learn through useful exchange
          </h2>
          <p className="max-w-sm leading-7 text-text-secondary">
            Meet trusted peers, agree on clear terms, book sessions, and keep the evidence of what you achieve.
          </p>
        </div>
        <div className="space-y-3 text-sm text-text-secondary">
          <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" />Privacy and contact controls</p>
          <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent" />Verified skills and credentials</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h2 className="font-heading text-xl font-bold text-text-primary">SkillSwap</h2>
          </div>
          <h1 className="mb-1 font-heading text-2xl font-semibold text-text-primary sm:text-3xl">{title}</h1>
          {subtitle && <p className="mb-6 text-sm leading-6 text-text-secondary">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

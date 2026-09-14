import { createContext, useContext, useId, useState } from "react";

const TabsContext = createContext(null);

export function Tabs({ defaultValue, value, onChange, children, className = "" }) {
  const baseId = useId();
  const [internalValue, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internalValue;
  const setValue = (v) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return (
    <div className={`flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1 ${className}`} role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.value === value;
  const safeValue = String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
  const onKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.currentTarget);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${safeValue}`}
      aria-controls={`${ctx.baseId}-panel-${safeValue}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      onKeyDown={onKeyDown}
      className={`
        shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow] duration-200
        ${isActive ? "bg-surface text-text-primary shadow-soft" : "text-text-secondary hover:text-text-primary"}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  const safeValue = String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
  return <div id={`${ctx.baseId}-panel-${safeValue}`} aria-labelledby={`${ctx.baseId}-tab-${safeValue}`} tabIndex={0} className={className} role="tabpanel">{children}</div>;
}

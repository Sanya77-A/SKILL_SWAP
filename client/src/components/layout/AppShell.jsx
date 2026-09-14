import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { cn } from "../../lib/utils";
import { fetchUnreadCount } from "../../features/notifications/notificationsSlice";

export function AppShell({ children, breadcrumbs, className = "" }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const drawerRef = useRef(null);
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isDemo = useSelector((state) => Boolean(state.auth.user?.isDemo));
  useEffect(() => { if (isAuthenticated && !isDemo) dispatch(fetchUnreadCount()); }, [dispatch, isAuthenticated, isDemo]);
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousFocus = document.activeElement;
    const drawer = drawerRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...(drawer?.querySelectorAll(focusableSelector) || [])]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className={cn("min-h-screen flex flex-col bg-background", className)}>
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden lg:block shrink-0">
          <Sidebar collapsed={false} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Mobile drawer overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu" className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
              <Sidebar collapsed={false} onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} breadcrumbs={breadcrumbs} />
          <main className="flex-1 overflow-x-hidden p-4 pb-24 sm:p-6 lg:pb-8 lg:pt-8">
            {children}
          </main>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}

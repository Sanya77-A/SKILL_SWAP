import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Compass, MessageSquare, Bell, User } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useSelector } from "react-redux";
import { cn } from "../../lib/utils";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notifications.unreadCount);

  if (!isAuthenticated) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {(user?.isDemo ? items.slice(0, 2) : items).map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl text-xs font-medium transition-colors",
                isActive ? "text-accent" : "text-text-secondary"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
        {!user?.isDemo && <Link
          to="/notifications"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl text-xs font-medium transition-colors",
            location.pathname === "/notifications" ? "text-accent" : "text-text-secondary"
          )}
          aria-current={location.pathname === "/notifications" ? "page" : undefined}
        >
          <span className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-danger text-[9px] text-on-accent flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          <span>Alerts</span>
        </Link>}
      </div>
    </nav>
  );
}

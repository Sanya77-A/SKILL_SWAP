import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  MessageSquare,
  Calendar,
  Bell,
  User,
  Shield,
  FileText,
  Store,
  Coins,
  Bot,
  Target,
  Map,
  BookOpen,
  Users,
  Presentation,
  Trophy,
  BadgeCheck,
  FolderKanban,
  ChartNoAxesCombined,
  Activity,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useSelector } from "react-redux";
import { cn } from "../../lib/utils";

const navGroups = [
  { label: "Workspace", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/discover", label: "Discover", icon: Compass },
    { to: "/feed", label: "Activity Feed", icon: Activity },
  ] },
  { label: "Marketplace", items: [
    { to: "/listings", label: "Listings", icon: Store },
    { to: "/proposals", label: "Proposals", icon: FileText },
    { to: "/bookings", label: "Bookings", icon: Calendar },
    { to: "/credits", label: "SkillCredits", icon: Coins },
  ] },
  { label: "Learning", items: [
    { to: "/assistant", label: "AI Assistant", icon: Bot },
    { to: "/skill-gap", label: "Career Skill Gap", icon: Target },
    { to: "/roadmaps", label: "Roadmaps", icon: Map },
    { to: "/learning", label: "My Learning", icon: BookOpen },
    { to: "/communities", label: "Communities", icon: Users },
    { to: "/group-sessions", label: "Group Sessions", icon: Presentation },
    { to: "/challenges", label: "Challenges", icon: Trophy },
    { to: "/certificates", label: "Certificates", icon: BadgeCheck },
  ] },
  { label: "Professional", items: [
    { to: "/projects", label: "Portfolio Projects", icon: FolderKanban },
    { to: "/mentor-analytics", label: "Mentor Analytics", icon: ChartNoAxesCombined },
  ] },
  { label: "Connect", items: [
    { to: "/chat", label: "Chat", icon: MessageSquare },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ] },
  { label: "Account", items: [
    { to: "/profile", label: "Profile", icon: User },
    { to: "/safety", label: "Safety Center", icon: ShieldAlert },
    { to: "/settings", label: "Settings", icon: Settings },
  ] },
];

export function Sidebar({ collapsed, onClose }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notifications.unreadCount);

  if (!isAuthenticated) return null;
  const visibleGroups = user?.isDemo ? [{ label: "Demo workspace", items: navGroups[0].items.slice(0, 2) }] : navGroups;

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-dvh flex-col border-r border-border bg-surface transition-[width] duration-250",
        collapsed ? "w-[72px]" : "w-64"
      )}
      onClick={onClose}
    >
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent">S</span>
          {!collapsed && <span className="font-heading font-semibold text-text-primary truncate">SkillSwap</span>}
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Workspace navigation">
        {visibleGroups.map((group) => <div key={group.label}>
          {!collapsed && <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{group.label}</p>}
          <div className="space-y-0.5">{group.items.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
          const isNotifications = to === "/notifications";
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-[color,background-color] duration-200",
                isActive ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              )}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
            >
              <span className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {isNotifications && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-[10px] text-on-accent flex items-center justify-center font-sans">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
          })}</div>
        </div>)}
        {["moderator", "admin", "super_admin"].includes(user?.role) && (
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-[color,background-color] duration-200",
              location.pathname.startsWith("/admin") ? "bg-danger/15 text-danger" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            )}
          >
            <Shield className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Admin</span>}
          </Link>
        )}
      </nav>
      <div className="p-2 border-t border-border space-y-1">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-text-secondary hover:bg-surface-2 hover:text-text-primary text-sm"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>
        {user && !collapsed && (
          <Link
            to="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-secondary hover:bg-surface-2"
          >
            <Avatar src={user.profilePhoto || user.profileImage} name={user.fullName || user.name} size="sm" />
            <span className="truncate text-sm">{user.fullName || user.name}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

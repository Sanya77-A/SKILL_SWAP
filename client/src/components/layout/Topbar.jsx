import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Bell, Menu, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/ThemeContext";

const breadcrumbMap = {
  "/dashboard": [],
  "/discover": ["Discover"],
  "/requests": ["Requests"],
  "/sessions": ["Sessions"],
  "/chat": ["Chat"],
  "/notifications": ["Notifications"],
  "/credits": ["SkillCredits"],
  "/assistant": ["AI Assistant"],
  "/profile": ["Profile"],
  "/admin": ["Admin"],
};

export function Topbar({ onMenuClick, breadcrumbs: propBreadcrumbs }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const { user, isAuthenticated } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notifications.unreadCount);
  const [searchQ, setSearchQ] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const breadcrumbs = propBreadcrumbs || breadcrumbMap[location.pathname] || (pathParts[0] ? [pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1)] : []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) navigate(`/discover?q=${encodeURIComponent(searchQ.trim())}`);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
    setProfileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-4 min-w-0">
        {isAuthenticated && (
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-xl p-2 text-text-secondary hover:bg-surface-2 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {!isAuthenticated && (
          <Link to="/" className="flex items-center gap-2 font-heading font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent">S</span>
            <span>SkillSwap</span>
          </Link>
        )}
        {breadcrumbs?.length > 0 && (
          <nav className="hidden sm:flex items-center gap-2 text-sm text-text-secondary" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-border">/</span>
                <span className={i === breadcrumbs.length - 1 ? "text-text-primary font-medium" : "hover:text-text-primary"}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 max-w-xl justify-end">
        {isAuthenticated && (
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="search"
                aria-label="Search SkillSwap"
                placeholder="Search skills..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </form>
        )}

        {!isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleTheme} className="rounded-xl p-2 text-text-secondary hover:bg-surface-2 hover:text-text-primary" aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="ghost" size="sm" asChild><Link to="/login">Login</Link></Button>
            <Button size="sm" asChild><Link to="/register">Create account</Link></Button>
          </div>
        ) : (
          <>
            {!user?.isDemo && <Link
              to="/notifications"
              className="relative p-2 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text-primary"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-[10px] text-on-accent flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-2"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <Avatar src={user?.profilePhoto || user?.profileImage} name={user?.fullName || user?.name} size="sm" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded-xl bg-surface border border-border shadow-glass z-50">
                    {!user?.isDemo && <Link
                      to="/profile"
                      className={cn("flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-2")}
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>}
                    {!user?.isDemo && <Link
                      to="/settings"
                      className={cn("flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-2")}
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </Link>}
                    {user?.isDemo && <p className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-warning">Read-only demo</p>}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 w-full text-sm text-text-primary hover:bg-surface-2 text-left"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

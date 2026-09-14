import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ children, admin = false }) {
  const { isAuthenticated, isInitializing, user } = useSelector((s) => s.auth);
  const location = useLocation();

  // Wait for first fetchMe to complete before deciding
  if (isInitializing) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center" role="status" aria-live="polite">
        <div className="w-full max-w-sm space-y-4" aria-hidden="true">
          <div className="skeleton-shimmer mx-auto h-12 w-12 rounded-xl" />
          <div className="skeleton-shimmer mx-auto h-5 w-40 rounded-lg" />
        </div>
        <span className="sr-only">Loading your workspace</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (admin && !["moderator", "admin", "super_admin"].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

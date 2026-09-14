import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchMe, clearAuth } from "./features/auth/authSlice";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const SessionsPage = lazy(() => import("./pages/SessionsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const ListingsPage = lazy(() => import("./pages/ListingsPage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const ProposalsPage = lazy(() => import("./pages/ProposalsPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const CreditsPage = lazy(() => import("./pages/CreditsPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const SkillGapPage = lazy(() => import("./pages/SkillGapPage"));
const RoadmapsPage = lazy(() => import("./pages/RoadmapsPage"));
const MyLearningPage = lazy(() => import("./pages/MyLearningPage"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage"));
const GroupSessionsPage = lazy(() => import("./pages/GroupSessionsPage"));
const ChallengesPage = lazy(() => import("./pages/ChallengesPage"));
const CertificatesPage = lazy(() => import("./pages/CertificatesPage"));
const VerifyCertificatePage = lazy(() => import("./pages/VerifyCertificatePage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const MentorAnalyticsPage = lazy(() => import("./pages/MentorAnalyticsPage"));
const ActivityFeedPage = lazy(() => import("./pages/ActivityFeedPage"));
const SafetyCenterPage = lazy(() => import("./pages/SafetyCenterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DemoMentorPage = lazy(() => import("./pages/DemoMentorPage"));

function RouteFallback() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-7xl items-center justify-center" role="status" aria-live="polite">
      <div className="w-full max-w-sm space-y-4" aria-hidden="true">
        <div className="skeleton-shimmer h-8 w-2/3 rounded-xl" />
        <div className="skeleton-shimmer h-36 w-full rounded-2xl" />
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify/certificate/:id" element={<VerifyCertificatePage />} />
        <Route path="onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
        <Route path="demo/mentor/:id" element={<ProtectedRoute><DemoMentorPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="listings" element={<ProtectedRoute><ListingsPage /></ProtectedRoute>} />
        <Route path="listing/:id" element={<ListingDetailPage />} />
        <Route path="proposals" element={<ProtectedRoute><ProposalsPage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
        <Route path="credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
        <Route path="assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
        <Route path="skill-gap" element={<ProtectedRoute><SkillGapPage /></ProtectedRoute>} />
        <Route path="roadmaps" element={<ProtectedRoute><RoadmapsPage /></ProtectedRoute>} />
        <Route path="learning" element={<ProtectedRoute><MyLearningPage /></ProtectedRoute>} />
        <Route path="communities" element={<ProtectedRoute><CommunitiesPage /></ProtectedRoute>} />
        <Route path="group-sessions" element={<ProtectedRoute><GroupSessionsPage /></ProtectedRoute>} />
        <Route path="challenges" element={<ProtectedRoute><ChallengesPage /></ProtectedRoute>} />
        <Route path="certificates" element={<ProtectedRoute><CertificatesPage /></ProtectedRoute>} />
        <Route path="projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        <Route path="mentor-analytics" element={<ProtectedRoute><MentorAnalyticsPage /></ProtectedRoute>} />
        <Route path="feed" element={<ProtectedRoute><ActivityFeedPage /></ProtectedRoute>} />
        <Route path="safety" element={<ProtectedRoute><SafetyCenterPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="user/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
        <Route path="requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
        <Route path="sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
        <Route path="chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="admin/*" element={<ProtectedRoute admin><AdminPage /></ProtectedRoute>} />
        <Route path=":profileHandle" element={<PublicProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

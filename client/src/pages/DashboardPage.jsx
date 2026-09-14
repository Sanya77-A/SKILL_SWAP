import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CalendarClock, Coins, Compass, GraduationCap, Inbox, Star } from "lucide-react";
import { fetchMatches } from "../features/matches/matchesSlice";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import { InlineNotice } from "../components/ui/InlineNotice";
import { api } from "../utils/api";

const formatSession = (booking) => booking ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short", timeZone: booking.timezone || undefined,
}).format(new Date(booking.startAt)) : "No session scheduled";

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data: matches } = useSelector((state) => state.matches);
  const [overview, setOverview] = useState(null);
  const [demoRecommendations, setDemoRecommendations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.isDemo) {
      let active = true;
      api.get("/demo/dashboard").then(({ data }) => {
        if (!active) return;
        setOverview(data.data);
        setDemoRecommendations(data.data.recommendations || []);
      }).catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "The demo dashboard could not be loaded.");
      });
      return () => { active = false; };
    }
    dispatch(fetchMatches({ page: 1, limit: 4 }));
    let active = true;
    Promise.all([
      api.get("/bookings", { params: { view: "upcoming", page: 1, limit: 1 } }),
      api.get("/proposals", { params: { type: "all", page: 1, limit: 10 } }),
      api.get("/credits/wallet"),
      api.get("/learning/me"),
      api.get("/notifications", { params: { unreadOnly: true, page: 1, limit: 1 } }),
    ]).then(([bookings, proposals, wallet, learning, notifications]) => {
      if (!active) return;
      const proposalItems = proposals.data.data || [];
      setOverview({
        nextBooking: bookings.data.data?.[0] || null,
        pendingProposal: proposalItems.find((item) => ["pending", "countered"].includes(item.status)) || null,
        wallet: wallet.data.data,
        learning: learning.data.data,
        notification: notifications.data.data?.[0] || null,
      });
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Your dashboard could not be loaded.");
    });
    return () => { active = false; };
  }, [dispatch, user?.isDemo]);

  const mentor = (user?.isDemo ? demoRecommendations : matches || [])[0];
  const mentorUser = mentor?.user || mentor;
  const learning = overview?.learning;
  const nextMilestone = learning?.milestones?.upcoming?.[0];

  if (!overview && !error) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-accent">Today</p>{user?.isDemo && <Badge variant="warning">Demo · read only</Badge>}</div>
        <h1 className="mt-1 font-heading text-3xl font-bold text-text-primary">Welcome back, {user?.name}</h1>
        <p className="mt-2 text-text-secondary">Pick up the next useful action in your learning exchange.</p>
      </header>

      {error && <Card className="border-danger/30 p-5 text-danger" role="alert">{error} <button className="ml-2 underline" onClick={() => window.location.reload()}>Try again</button></Card>}

      {overview && <>
        {user?.isDemo && <InlineNotice title="Fictional workspace">{overview.notice} Sessions, balances, progress, and notifications below are examples only.</InlineNotice>}
        {user?.isDemo && <section aria-labelledby="demo-profile" className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2"><p className="text-sm font-medium text-accent">Demo profile</p><h2 id="demo-profile" className="mt-2 font-heading text-xl font-semibold text-text-primary">{overview.profile?.headline}</h2><p className="mt-3 text-sm leading-6 text-text-secondary">{overview.profile?.bio}</p><p className="mt-4 text-sm text-text-secondary">{overview.profile?.location} · {(overview.profile?.languages || []).join(" · ")}</p></Card>
          <Card className="p-6"><p className="text-sm font-medium text-text-secondary">Sample skills</p><p className="mt-3 text-sm text-text-primary"><span className="font-semibold">Can share:</span> {(overview.skills?.offered || []).join(", ")}</p><p className="mt-2 text-sm text-text-primary"><span className="font-semibold">Learning:</span> {(overview.skills?.wanted || []).join(", ")}</p><p className="mt-4 text-xs text-text-secondary">Profile completeness {overview.profile?.profileCompleteness}%</p></Card>
        </section>}
        <section aria-labelledby="dashboard-priorities" className="grid gap-4 lg:grid-cols-12">
          <h2 id="dashboard-priorities" className="sr-only">Your priorities</h2>
          <Card className="p-6 lg:col-span-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-medium text-accent">Next session</p><h3 className="mt-2 font-heading text-2xl font-semibold text-text-primary">{overview.nextBooking?.skill?.name || "Your calendar is open"}</h3></div>
              <CalendarClock className="h-6 w-6 text-accent" aria-hidden="true" />
            </div>
            {overview.nextBooking ? <>
              <p className="mt-3 text-text-secondary">{formatSession(overview.nextBooking)} · {overview.nextBooking.duration} minutes · {overview.nextBooking.mode.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm text-text-secondary">With {overview.nextBooking.teacher?._id === user?._id ? overview.nextBooking.student?.name : overview.nextBooking.teacher?.name}</p>
            </> : <p className="mt-3 text-text-secondary">Explore mentors or accept a proposal to schedule your next session.</p>}
            <Button asChild className="mt-6"><Link to={user?.isDemo ? "/dashboard" : overview.nextBooking ? "/bookings" : "/discover"}>{user?.isDemo ? "Sample session" : overview.nextBooking ? "View booking" : "Find a mentor"}</Link></Button>
          </Card>

          <Card className="p-6 lg:col-span-5">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-text-secondary">SkillCredit balance</p><Coins className="h-5 w-5 text-warning" aria-hidden="true" /></div>
            <p className="mt-4 font-heading text-4xl font-bold text-text-primary">{overview.wallet?.balance ?? 0}</p>
            <p className="mt-2 text-sm text-text-secondary">Ledger {overview.wallet?.integrityValid ? "verified" : "needs reconciliation"}</p>
            <Button asChild variant="secondary" className="mt-6"><Link to={user?.isDemo ? "/dashboard" : "/credits"}>{user?.isDemo ? "Read-only sample" : "View ledger"}</Link></Button>
          </Card>

          <Card className="p-6 lg:col-span-4">
            <GraduationCap className="h-5 w-5 text-accent" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-text-secondary">Current learning</p>
            <h3 className="mt-1 font-heading text-lg font-semibold text-text-primary">{nextMilestone?.title || learning?.activeSkills?.[0]?.skill?.name || "Choose a learning goal"}</h3>
            <p className="mt-2 text-sm text-text-secondary">{learning?.summary?.activeRoadmaps || 0} active roadmap{learning?.summary?.activeRoadmaps === 1 ? "" : "s"}</p>
            <Link to={user?.isDemo ? "/dashboard" : "/learning"} className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">{user?.isDemo ? "Sample progress" : "Open learning hub"}</Link>
          </Card>

          <Card className="p-6 lg:col-span-4">
            <Inbox className="h-5 w-5 text-accent" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-text-secondary">Pending proposal</p>
            <h3 className="mt-1 font-heading text-lg font-semibold text-text-primary">{overview.pendingProposal ? `${overview.pendingProposal.offeredSkill?.name} for ${overview.pendingProposal.requestedSkill?.name}` : "Nothing needs a response"}</h3>
            <p className="mt-2 text-sm text-text-secondary">{overview.pendingProposal ? `Status: ${overview.pendingProposal.status}` : "New and countered proposals will appear here."}</p>
            <Link to={user?.isDemo ? "/dashboard" : "/proposals"} className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">{user?.isDemo ? "No demo mutation" : "Review proposals"}</Link>
          </Card>

          <Card className="p-6 lg:col-span-4">
            <Star className="h-5 w-5 text-accent" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-text-secondary">Useful notification</p>
            <h3 className="mt-1 font-heading text-lg font-semibold text-text-primary">{overview.notification?.title || "You are caught up"}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{overview.notification?.body || "Important booking and proposal updates will appear here."}</p>
            <Link to={user?.isDemo ? "/dashboard" : overview.notification?.link || "/notifications"} className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">{user?.isDemo ? "Sample notification" : "View notifications"}</Link>
          </Card>
        </section>

        <section aria-labelledby="recommended-mentor">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-medium text-accent">Recommended mentor</p><h2 id="recommended-mentor" className="font-heading text-2xl font-semibold text-text-primary">A relevant person, with reasons</h2></div><Button asChild variant="secondary"><Link to="/discover"><Compass className="h-4 w-4" />Explore</Link></Button></div>
          {mentorUser?._id ? <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <Avatar src={mentorUser.profileImage || mentorUser.profilePhoto} name={mentorUser.name} size="lg" />
            <div className="min-w-0 flex-1"><h3 className="font-heading text-xl font-semibold text-text-primary">{mentorUser.name}</h3><p className="mt-1 text-sm text-text-secondary">{mentorUser.headline || "SkillSwap mentor"} · {Number(mentorUser.ratingAvg || 0).toFixed(1)} from {mentorUser.ratingCount || 0} reviews</p><p className="mt-3 text-sm text-text-secondary">{mentor?.reasons?.slice(0, 2).join(" · ") || "Recommended from your recorded skills and preferences."}</p></div>
            <Button asChild><Link to={user?.isDemo ? `/demo/mentor/${mentorUser._id}` : `/user/${mentorUser._id}`}>View profile</Link></Button>
          </Card> : <Card className="p-8 text-center"><h3 className="font-heading text-lg font-semibold text-text-primary">No mentor recommendation yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">Add the skills you want to learn and your availability to improve matching.</p><Button asChild className="mt-5"><Link to="/profile">Complete profile</Link></Button></Card>}
        </section>
      </>}
    </div>
  );
}

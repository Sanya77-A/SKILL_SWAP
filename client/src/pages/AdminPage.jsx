import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Activity, BadgeCheck, BookOpenCheck, CircleDollarSign, Flag, LayoutDashboard, ListChecks, MessageSquareWarning, ShieldCheck, Star, Store, Users, UsersRound } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";

const areas = [
  ["analytics", "Analytics", "analytics:read", LayoutDashboard], ["users", "Users", "users:read", Users], ["skills", "Skills", "catalog:read", ListChecks],
  ["listings", "Listings", "content:read", Store], ["reports", "Reports", "moderation:read", Flag], ["disputes", "Disputes", "moderation:read", MessageSquareWarning],
  ["reviews", "Reviews", "content:read", Star], ["communities", "Communities", "content:read", UsersRound], ["sessions", "Sessions", "sessions:read", BookOpenCheck],
  ["transactions", "Transactions", "transactions:read", CircleDollarSign], ["verification-requests", "Verification", "verification:read", BadgeCheck],
];
const nice = (value = "") => value.replaceAll("_", " ");
const nameOf = (value) => value?.fullName || value?.name || value?.username || "Not available";

export default function AdminPage() {
  const [access, setAccess] = useState(null);
  const [area, setArea] = useState("");
  const [data, setData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessionKind, setSessionKind] = useState("booking");
  const visibleAreas = useMemo(() => areas.filter(([, , permission]) => access?.permissions?.includes(permission)), [access]);

  useEffect(() => {
    api.get("/admin/access").then((response) => {
      const value = response.data.data; setAccess(value);
      const first = areas.find(([, , permission]) => value.permissions.includes(permission)); setArea(first?.[0] || "");
    }).catch((error) => toast.error(error.response?.data?.message || "Admin access unavailable"));
  }, []);

  const load = useCallback(async () => {
    if (!area) return; setLoading(true);
    try {
      if (area === "analytics") { const [summary, range] = await Promise.all([api.get("/admin/stats"), api.get("/admin/analytics", { params: { days: 30 } })]); setAnalytics({ ...summary.data.data, range: range.data.data }); setData([]); }
      else { const response = await api.get(`/admin/${area}`, { params: area === "sessions" ? { kind: sessionKind, limit: 50 } : { limit: 50 } }); setData(response.data.data || []); }
    } catch (error) { setData([]); toast.error(error.response?.data?.message || `Could not load ${nice(area)}`); }
    finally { setLoading(false); }
  }, [area, sessionKind]);
  useEffect(() => { load(); }, [load]);

  const mutate = async (path, payload, success) => {
    setBusy(true);
    try { await api.patch(path, payload); toast.success(success); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Admin action failed"); }
    finally { setBusy(false); }
  };
  const noteAction = (path, status, success) => { const note = window.prompt(`Reason for “${nice(status)}”:`); if (note?.trim()) mutate(path, { status, note: note.trim() }, success); };

  if (!access) return <p className="py-16 text-center text-text-secondary" role="status">Loading admin access…</p>;
  if (!visibleAreas.length) return <Card className="mx-auto mt-16 max-w-lg p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-text-secondary" /><h1 className="mt-3 font-heading text-xl font-semibold text-text-primary">No admin permissions</h1><p className="mt-1 text-sm text-text-secondary">Your account does not have access to platform administration.</p></Card>;

  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Admin Dashboard</h1></div><p className="mt-1 text-sm text-text-secondary">Server-enforced access for <strong>{nice(access.role)}</strong>.</p></div><Badge variant="accent">{access.permissions.length} permissions</Badge></header>
    <Tabs value={area} onChange={setArea}><TabsList className="flex-wrap">{visibleAreas.map(([key, label, , Icon]) => <TabsTrigger key={key} value={key}><span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4" />{label}</span></TabsTrigger>)}</TabsList>
      {visibleAreas.map(([key]) => <TabsContent key={key} value={key} className="mt-5">{key === "analytics" ? <Analytics data={analytics} loading={loading} /> : <ResourceArea area={key} data={data} loading={loading} busy={busy} permissions={access.permissions} sessionKind={sessionKind} setSessionKind={setSessionKind} mutate={mutate} noteAction={noteAction} />}</TabsContent>)}
    </Tabs>
  </div>;
}

function Analytics({ data, loading }) {
  if (loading || !data) return <Loading />;
  const metrics = [["Users", data.userCount], ["Active accounts", data.activeUsers], ["Skills", data.skillCount], ["Listings", data.listingCount], ["Bookings", data.bookingCount], ["Group sessions", data.groupSessionCount], ["Visible reviews", data.reviewCount], ["Open reports", data.openReports], ["Open disputes", data.openDisputes], ["Transactions", data.transactionCount], ["Pending verification", data.pendingVerifications], ["Messages", data.messageCount]];
  return <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value]) => <Card key={label}><CardContent><p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold text-text-primary">{value ?? 0}</p></CardContent></Card>)}</div><Card className="mt-5"><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Last {data.range?.rangeDays} days</h2></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Signups", data.range?.signups], ["Bookings", data.range?.bookings], ["Completed", data.range?.completedBookings], ["Completion rate", `${data.range?.completionRate || 0}%`], ["Credit volume", data.range?.creditVolume]].map(([label, value]) => <div key={label}><p className="text-sm text-text-secondary">{label}</p><p className="text-xl font-semibold text-text-primary">{value ?? 0}</p></div>)}</CardContent></Card></>;
}

function ResourceArea({ area, data, loading, busy, permissions, sessionKind, setSessionKind, mutate, noteAction }) {
  if (loading) return <Loading />;
  return <Card><CardHeader className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold capitalize text-text-primary">{nice(area)}</h2><p className="mt-1 text-xs text-text-secondary">{data.length} records loaded · all writes are permission-checked and audited.</p></div>{area === "sessions" && <Select aria-label="Session type" value={sessionKind} onChange={(event) => setSessionKind(event.target.value)} options={[{ value: "booking", label: "Bookings" }, { value: "group", label: "Group sessions" }, { value: "legacy", label: "Legacy sessions" }]} />}{["reports", "disputes"].includes(area) && <Button asChild size="sm"><Link to="/safety">Open moderation workflow</Link></Button>}</CardHeader><CardContent className="space-y-3">{data.length ? data.map((item) => <ResourceRow key={item._id} area={area} item={item} busy={busy} permissions={permissions} mutate={mutate} noteAction={noteAction} />) : <p className="py-10 text-center text-sm text-text-secondary">No records in this area.</p>}</CardContent></Card>;
}

function ResourceRow({ area, item, busy, permissions, mutate, noteAction }) {
  let title = item.title || item.name || item.transactionId || item.bookingCode || item.skill?.name || item.targetType || "Record";
  let detail = item.email || item.description || item.reason || item.comment || item.category || item.type || "";
  if (area === "users") { title = nameOf(item); detail = item.email; }
  if (area === "listings") detail = `${nameOf(item.owner)} · ${item.skill?.name || "Skill"}`;
  if (area === "reports") title = `${nice(item.targetType)} report`;
  if (area === "disputes") title = `${item.booking?.skill?.name || "Session"} dispute`;
  if (area === "reviews") { title = `${nameOf(item.reviewer)} → ${nameOf(item.reviewee)}`; detail = item.comment || `${item.ratings?.overall || item.rating}/5 review`; }
  if (area === "transactions") detail = `${nameOf(item.user)} · ${item.amount > 0 ? "+" : ""}${item.amount} credits · balance ${item.balanceAfter}`;
  if (area === "verification-requests") { title = `${item.skill?.name || "Skill"} · ${nameOf(item.user)}`; detail = `${item.proficiency} · ${item.evidence?.length || 0} evidence link(s)`; }
  const status = item.status || item.moderationStatus || item.verificationStatus || item.role;
  return <article className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-medium text-text-primary">{title}</h3>{status && <Badge variant={["active", "published", "visible", "verified", "completed"].includes(status) ? "success" : ["suspended", "archived", "hidden", "rejected", "cancelled"].includes(status) ? "danger" : "default"}>{nice(status)}</Badge>}{item.isBlocked && <Badge variant="danger">blocked</Badge>}</div><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{detail}</p><p className="mt-1 text-xs text-text-secondary">ID {item._id}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Actions area={area} item={item} busy={busy} permissions={permissions} mutate={mutate} noteAction={noteAction} /></div></article>;
}

function Actions({ area, item, busy, permissions, mutate, noteAction }) {
  if (area === "users" && permissions.includes("users:write")) return <>{item.isBlocked ? <Button size="sm" variant="success" disabled={busy} onClick={() => mutate(`/admin/users/${item._id}/unblock`, {}, "Account unblocked")}>Unblock</Button> : <Button size="sm" variant="secondary" disabled={busy} onClick={() => mutate(`/admin/users/${item._id}/block`, {}, "Account blocked")}>Block</Button>}{permissions.includes("roles:write") && <Select aria-label={`Role for ${nameOf(item)}`} value={item.role} onChange={(event) => mutate(`/admin/users/${item._id}/role`, { role: event.target.value, note: "Role changed in admin dashboard" }, "Role updated")} disabled={busy} options={["user", "mentor", "moderator", "admin"].map((value) => ({ value, label: nice(value) }))} />}</>;
  if (area === "skills" && permissions.includes("catalog:write")) return <Button size="sm" variant="secondary" disabled={busy} onClick={() => noteAction(`/admin/skills/${item._id}`, item.status === "active" ? "archived" : "active", "Skill status updated")}>{item.status === "active" ? "Archive" : "Restore"}</Button>;
  if (area === "listings" && permissions.includes("content:moderate")) return <>{item.status !== "paused" && item.status !== "archived" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => noteAction(`/admin/listings/${item._id}`, "paused", "Listing paused")}>Pause</Button>}{item.status !== "archived" && <Button size="sm" variant="danger" disabled={busy} onClick={() => noteAction(`/admin/listings/${item._id}`, "archived", "Listing archived")}>Archive</Button>}</>;
  if (area === "reviews" && permissions.includes("content:moderate")) return <Button size="sm" variant={item.moderationStatus === "hidden" ? "success" : "danger"} disabled={busy} onClick={() => noteAction(`/admin/reviews/${item._id}`, item.moderationStatus === "hidden" ? "visible" : "hidden", "Review visibility updated")}>{item.moderationStatus === "hidden" ? "Restore" : "Hide"}</Button>;
  if (area === "communities" && permissions.includes("content:moderate")) return <Button size="sm" variant={item.status === "archived" ? "success" : "danger"} disabled={busy} onClick={() => noteAction(`/admin/communities/${item._id}`, item.status === "archived" ? "active" : "archived", "Community status updated")}>{item.status === "archived" ? "Restore" : "Archive"}</Button>;
  if (area === "verification-requests" && permissions.includes("verification:write") && item.verificationStatus === "pending") return <><Button size="sm" variant="success" disabled={busy} onClick={() => noteAction(`/admin/verification-requests/${item._id}`, "verified", "Skill verified")}>Verify</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => noteAction(`/admin/verification-requests/${item._id}`, "rejected", "Verification rejected")}>Reject</Button></>;
  return null;
}

function Loading() { return <Card><CardContent className="py-14 text-center text-sm text-text-secondary"><Activity className="mx-auto mb-2 h-5 w-5 animate-pulse text-accent" />Loading records…</CardContent></Card>; }

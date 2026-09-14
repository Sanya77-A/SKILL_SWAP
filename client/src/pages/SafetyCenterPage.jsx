import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, Ban, Flag, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";

const reportCategories = ["spam", "harassment", "scam", "inappropriate", "safety", "privacy", "other"];
const disputeCategories = ["no_show", "service_quality", "harassment", "misrepresentation", "payment", "safety", "other"];
const reportTransitions = { submitted: ["triaged", "dismissed"], triaged: ["in_review", "resolved", "dismissed"], in_review: ["resolved", "dismissed"] };
const disputeTransitions = { open: ["under_review", "resolved_refund", "resolved_no_action", "dismissed"], under_review: ["resolved_refund", "resolved_no_action", "dismissed"] };
const nice = (value = "") => value.replaceAll("_", " ");

function StatusBadge({ value }) {
  const variant = ["resolved", "resolved_refund", "resolved_no_action"].includes(value) ? "success" : value === "dismissed" ? "default" : "warning";
  return <Badge variant={variant}>{nice(value)}</Badge>;
}

export default function SafetyCenterPage() {
  const me = useSelector((state) => state.auth.user);
  const [params] = useSearchParams();
  const linkedTargetId = params.get("targetId") || params.get("userId") || "";
  const [tab, setTab] = useState(params.get("bookingId") ? "disputes" : linkedTargetId ? "report" : "overview");
  const [blocks, setBlocks] = useState([]);
  const [reports, setReports] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminDisputes, setAdminDisputes] = useState([]);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState({ targetType: params.get("targetType") || "user", targetId: linkedTargetId, category: "safety", reason: "", evidence: "" });
  const [dispute, setDispute] = useState({ bookingId: params.get("bookingId") || "", category: "service_quality", description: "", evidence: "" });
  const isAdmin = ["moderator", "admin", "super_admin"].includes(me?.role);

  const load = useCallback(async () => {
    try {
      const requests = [api.get("/safety/blocks"), api.get("/safety/reports/me"), api.get("/safety/disputes/me")];
      if (isAdmin) requests.push(api.get("/safety/moderation/reports"), api.get("/safety/moderation/disputes"));
      const [blockResult, reportResult, disputeResult, adminReportResult, adminDisputeResult] = await Promise.all(requests);
      setBlocks(blockResult.data.data || []); setReports(reportResult.data.data || []); setDisputes(disputeResult.data.data || []);
      if (adminReportResult) setAdminReports(adminReportResult.data.data || []);
      if (adminDisputeResult) setAdminDisputes(adminDisputeResult.data.data || []);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load safety center"); }
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const searchMembers = async (event) => {
    event.preventDefault(); if (query.trim().length < 2) return;
    setSearching(true);
    try { const response = await api.get("/users", { params: { q: query.trim(), limit: 8 } }); setMembers(response.data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Search failed"); }
    finally { setSearching(false); }
  };
  const blockMember = async (member) => {
    setBusy(true);
    try { await api.post(`/safety/blocks/${member._id}`, { reason: "Blocked from Safety Center" }); toast.success(`${member.fullName || member.name} blocked`); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not block member"); }
    finally { setBusy(false); }
  };
  const unblockMember = async (id) => {
    setBusy(true);
    try { await api.delete(`/safety/blocks/${id}`); toast.success("Member unblocked"); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not unblock member"); }
    finally { setBusy(false); }
  };
  const submitReport = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const evidenceUrls = report.evidence.split("\n").map((value) => value.trim()).filter(Boolean);
      const response = await api.post("/safety/reports", { targetType: report.targetType, targetId: report.targetId.trim(), category: report.category, reason: report.reason.trim(), evidenceUrls });
      toast.success(response.data.data?.replayed ? "This report was already received" : "Report submitted securely");
      setReport((value) => ({ ...value, reason: "", evidence: "" })); await load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not submit report"); }
    finally { setBusy(false); }
  };
  const submitDispute = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const evidenceUrls = dispute.evidence.split("\n").map((value) => value.trim()).filter(Boolean);
      await api.post(`/safety/disputes/bookings/${dispute.bookingId.trim()}`, { category: dispute.category, description: dispute.description.trim(), evidenceUrls });
      toast.success("Dispute opened; the session is paused for review"); setDispute((value) => ({ ...value, description: "", evidence: "" })); await load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not open dispute"); }
    finally { setBusy(false); }
  };
  const moderate = async (kind, id, status) => {
    const note = window.prompt(`Add a moderation note for “${nice(status)}”:`);
    if (!note?.trim()) return;
    setBusy(true);
    try { await api.patch(`/safety/moderation/${kind}/${id}`, { status, note: note.trim() }); toast.success("Moderation status updated"); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update moderation status"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <header><div className="flex items-center gap-3"><ShieldAlert className="h-8 w-8 text-accent" /><div><h1 className="font-heading text-3xl font-bold text-text-primary">Safety Center</h1><p className="mt-1 text-sm text-text-secondary">Control contact, report concerns, and track disputes.</p></div></div></header>
    <Card className="border-accent/20 bg-accent/5"><CardContent className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-accent" /><p className="text-sm text-text-secondary"><strong className="text-text-primary">Immediate danger?</strong> Contact local emergency services. Reports here are reviewed inside SkillSwap and are not a substitute for emergency help.</p></CardContent></Card>
    <Tabs value={tab} onChange={setTab}><TabsList className="flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="blocks">Blocked members</TabsTrigger><TabsTrigger value="report">Report</TabsTrigger><TabsTrigger value="disputes">Disputes</TabsTrigger>{isAdmin && <TabsTrigger value="moderation">Moderation</TabsTrigger>}</TabsList>
      <TabsContent value="overview"><div className="grid gap-4 sm:grid-cols-3"><SummaryCard icon={Ban} label="Blocked members" value={blocks.length} /><SummaryCard icon={Flag} label="My reports" value={reports.length} /><SummaryCard icon={AlertTriangle} label="Session disputes" value={disputes.length} /></div><Card className="mt-4"><CardContent><h2 className="font-heading text-lg font-semibold text-text-primary">How protection works</h2><ul className="mt-3 space-y-2 text-sm text-text-secondary"><li>• Blocking is bilateral for contact: proposals, requests, messages, bookings, and calls are stopped.</li><li>• Existing conversation history remains available as a record, but new contact is prevented.</li><li>• Reports and disputes have an auditable moderation history.</li></ul></CardContent></Card></TabsContent>
      <TabsContent value="blocks"><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Find a member to block</h2></CardHeader><CardContent><form onSubmit={searchMembers} className="flex gap-2"><Input aria-label="Search members" placeholder="Name or skill" value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="submit" disabled={searching || query.trim().length < 2}><Search className="h-4 w-4" />Search</Button></form><div className="mt-4 space-y-2">{members.map((member) => <MemberRow key={member._id} member={member} action={<Button size="sm" variant="danger" disabled={busy || blocks.some((item) => item.blocked?._id === member._id)} onClick={() => blockMember(member)}>{blocks.some((item) => item.blocked?._id === member._id) ? "Blocked" : "Block"}</Button>} />)}</div></CardContent></Card><Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Your blocked list</h2></CardHeader><CardContent className="space-y-2">{blocks.length ? blocks.map((item) => <MemberRow key={item._id} member={item.blocked} action={<Button size="sm" variant="secondary" disabled={busy} onClick={() => unblockMember(item.blocked._id)}>Unblock</Button>} />) : <p className="text-sm text-text-secondary">You have not blocked anyone.</p>}</CardContent></Card></div></TabsContent>
      <TabsContent value="report"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]"><Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Submit a report</h2></CardHeader><CardContent><form onSubmit={submitReport} className="space-y-4"><Select label="What are you reporting?" value={report.targetType} onChange={(event) => setReport((value) => ({ ...value, targetType: event.target.value }))} options={["user", "listing", "message", "review"].map((value) => ({ value, label: nice(value) }))} /><Input label="Target ID" required value={report.targetId} onChange={(event) => setReport((value) => ({ ...value, targetId: event.target.value }))} placeholder="Paste the member or content ID" /><Select label="Category" value={report.category} onChange={(event) => setReport((value) => ({ ...value, category: event.target.value }))} options={reportCategories.map((value) => ({ value, label: nice(value) }))} /><TextArea label="What happened?" required minLength={5} maxLength={1000} value={report.reason} onChange={(event) => setReport((value) => ({ ...value, reason: event.target.value }))} /><TextArea label="Evidence links (one per line, optional)" rows={3} value={report.evidence} onChange={(event) => setReport((value) => ({ ...value, evidence: event.target.value }))} /><Button type="submit" disabled={busy || !report.targetId.trim() || report.reason.trim().length < 5}>Submit report</Button></form></CardContent></Card><History title="My reports" items={reports} render={(item) => <div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{nice(item.targetType)} · {nice(item.category)}</p><StatusBadge value={item.status} /></div><p className="mt-1 text-sm text-text-secondary">{item.reason}</p><p className="mt-1 text-xs text-text-secondary">Submitted {new Date(item.createdAt).toLocaleString()}</p></div>} /></div></TabsContent>
      <TabsContent value="disputes"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]"><Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Dispute an active session</h2></CardHeader><CardContent><form onSubmit={submitDispute} className="space-y-4"><Input label="Booking ID" required value={dispute.bookingId} onChange={(event) => setDispute((value) => ({ ...value, bookingId: event.target.value }))} placeholder="Use Dispute in Bookings to fill this automatically" /><Select label="Category" value={dispute.category} onChange={(event) => setDispute((value) => ({ ...value, category: event.target.value }))} options={disputeCategories.map((value) => ({ value, label: nice(value) }))} /><TextArea label="Describe the issue" required minLength={10} maxLength={3000} value={dispute.description} onChange={(event) => setDispute((value) => ({ ...value, description: event.target.value }))} /><TextArea label="Evidence links (one per line, optional)" rows={3} value={dispute.evidence} onChange={(event) => setDispute((value) => ({ ...value, evidence: event.target.value }))} /><Button type="submit" disabled={busy || !dispute.bookingId.trim() || dispute.description.trim().length < 10}>Open dispute</Button></form></CardContent></Card><History title="My disputes" items={disputes} render={(item) => <div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{item.booking?.skill?.name || "Session"} · {nice(item.category)}</p><StatusBadge value={item.status} /></div><p className="mt-1 text-sm text-text-secondary">{item.description}</p>{item.resolution && <p className="mt-2 text-sm text-text-primary">Resolution: {item.resolution}</p>}</div>} /></div></TabsContent>
      {isAdmin && <TabsContent value="moderation"><div className="grid gap-6 xl:grid-cols-2"><ModerationList title="Report queue" items={adminReports} transitions={reportTransitions} kind="reports" moderate={moderate} busy={busy} renderTitle={(item) => `${nice(item.targetType)} · ${nice(item.category)}`} renderBody={(item) => item.reason} /><ModerationList title="Dispute queue" items={adminDisputes} transitions={disputeTransitions} kind="disputes" moderate={moderate} busy={busy} renderTitle={(item) => `${item.booking?.skill?.name || "Session"} · ${nice(item.category)}`} renderBody={(item) => item.description} /></div></TabsContent>}
    </Tabs>
  </div>;
}

function SummaryCard({ icon: Icon, label, value }) { return <Card><CardContent><Icon className="h-5 w-5 text-accent" /><p className="mt-3 text-2xl font-semibold text-text-primary">{value}</p><p className="text-sm text-text-secondary">{label}</p></CardContent></Card>; }
function TextArea({ label, ...props }) { const id = label.toLowerCase().replaceAll(" ", "-"); return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-secondary">{label}</label><textarea id={id} rows={4} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" {...props} /></div>; }
function MemberRow({ member, action }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="flex min-w-0 items-center gap-3"><Avatar src={member?.profilePhoto || member?.profileImage} name={member?.fullName || member?.name} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-medium text-text-primary">{member?.fullName || member?.name}</p><p className="truncate text-xs text-text-secondary">@{member?.username || "member"}</p></div></div>{action}</div>; }
function History({ title, items, render }) { return <Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">{title}</h2></CardHeader><CardContent className="space-y-3">{items.length ? items.map((item) => <article key={item._id} className="rounded-xl border border-border p-4">{render(item)}</article>) : <p className="text-sm text-text-secondary">Nothing here yet.</p>}</CardContent></Card>; }
function ModerationList({ title, items, transitions, kind, moderate, busy, renderTitle, renderBody }) { return <Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">{title}</h2></CardHeader><CardContent className="space-y-3">{items.length ? items.map((item) => <article key={item._id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{renderTitle(item)}</p><StatusBadge value={item.status} /><Badge variant={item.priority === "high" ? "danger" : "default"}>{item.priority || "normal"}</Badge></div><p className="mt-2 text-sm text-text-secondary">{renderBody(item)}</p><div className="mt-3 flex flex-wrap gap-2">{(transitions[item.status] || []).map((status) => <Button key={status} size="sm" variant={status === "dismissed" ? "secondary" : status.includes("resolved") ? "success" : "primary"} disabled={busy} onClick={() => moderate(kind, item._id, status)}>{nice(status)}</Button>)}</div></article>) : <p className="text-sm text-text-secondary">The queue is clear.</p>}</CardContent></Card>; }

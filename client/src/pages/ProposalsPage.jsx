import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { ArrowRightLeft, Clock3 } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { BookingComposer } from "../components/bookings/BookingComposer";

const statusVariant = { accepted: "success", pending: "accent", countered: "warning", declined: "danger", cancelled: "default", expired: "default", draft: "default", completed: "success" };

export default function ProposalsPage() {
  const me = useSelector((state) => state.auth.user);
  const [tab, setTab] = useState("all");
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countering, setCountering] = useState(null);
  const [bookingProposal, setBookingProposal] = useState(null);
  const [counter, setCounter] = useState({ offeredSessions: 1, requestedSessions: 1, duration: 60, message: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await api.get("/proposals", { params: { type: tab, limit: 50 } }); setProposals(response.data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Could not load proposals"); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const act = async (proposal, action, payload = {}) => {
    try { await api.post(`/proposals/${proposal._id}/${action}`, payload); toast.success(`Proposal ${action === "accept" ? "accepted" : action === "decline" ? "declined" : action === "cancel" ? "cancelled" : "updated"}`); setCountering(null); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Action failed"); }
  };
  const openCounter = (proposal) => { setCountering(proposal); setCounter({ offeredSessions: proposal.offeredSessions, requestedSessions: proposal.requestedSessions, duration: proposal.duration, message: proposal.message || "" }); };

  return <div><header className="mb-6"><h1 className="font-heading text-3xl font-bold text-text-primary">Swap proposals</h1><p className="mt-1 text-sm text-text-secondary">Negotiate skills, sessions, schedules, credits, and payment in one auditable thread.</p></header><Tabs value={tab} onChange={setTab}><TabsList className="mb-6"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="incoming">Incoming</TabsTrigger><TabsTrigger value="outgoing">Outgoing</TabsTrigger></TabsList>{["all", "incoming", "outgoing"].map((value) => <TabsContent key={value} value={value}>{loading ? <p className="py-12 text-center text-text-secondary" role="status">Loading proposals…</p> : proposals.length ? <div className="space-y-4">{proposals.map((proposal) => {
    const isRequester = proposal.requester._id === me?._id; const other = isRequester ? proposal.recipient : proposal.requester; const canRespond = proposal.actionRequiredBy === me?._id && ["pending", "countered"].includes(proposal.status);
    return <Card key={proposal._id}><CardContent><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="flex gap-3"><Avatar src={other.profilePhoto} name={other.fullName || other.name} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium text-text-primary">{other.fullName || other.name}</h2><Badge variant={statusVariant[proposal.status]}>{proposal.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{proposal.offeredSkill.name} <ArrowRightLeft className="mx-1 inline h-3.5 w-3.5" /> {proposal.requestedSkill.name}</p><p className="mt-1 text-xs text-text-secondary"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{proposal.duration} min · {proposal.deliveryMode.replaceAll("_", " ")} · revision {proposal.revisions.length}</p>{proposal.message && <p className="mt-3 max-w-xl text-sm text-text-secondary">{proposal.message}</p>}</div></div><div className="flex flex-wrap items-start gap-2">{proposal.status === "draft" && isRequester && <Button size="sm" onClick={() => act(proposal, "submit")}>Submit</Button>}{canRespond && <><Button size="sm" onClick={() => act(proposal, "accept")}>Accept</Button><Button size="sm" variant="secondary" onClick={() => openCounter(proposal)}>Counter</Button><Button size="sm" variant="danger" onClick={() => act(proposal, "decline")}>Decline</Button></>}{proposal.status === "accepted" && <Button size="sm" onClick={() => setBookingProposal(proposal)}>Schedule session</Button>}{isRequester && ["draft", "pending", "countered"].includes(proposal.status) && <Button size="sm" variant="secondary" onClick={() => act(proposal, "cancel")}>Cancel</Button>}</div></div></CardContent></Card>;
  })}</div> : <Card className="p-12 text-center text-text-secondary">No {tab === "all" ? "" : tab} proposals yet.</Card>}</TabsContent>)}</Tabs>
  <Modal open={Boolean(countering)} onClose={() => setCountering(null)} title="Counter proposal"><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Input label="Sessions offered" type="number" min="0" value={counter.offeredSessions} onChange={(event) => setCounter((value) => ({ ...value, offeredSessions: event.target.value }))} /><Input label="Sessions requested" type="number" min="1" value={counter.requestedSessions} onChange={(event) => setCounter((value) => ({ ...value, requestedSessions: event.target.value }))} /></div><Input label="Duration (minutes)" type="number" min="15" step="15" value={counter.duration} onChange={(event) => setCounter((value) => ({ ...value, duration: event.target.value }))} /><div><label className="mb-1.5 block text-sm font-medium text-text-secondary">Message</label><textarea aria-label="Counter-proposal message" rows={3} value={counter.message} onChange={(event) => setCounter((value) => ({ ...value, message: event.target.value }))} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text-primary" /></div><Button onClick={() => act(countering, "counter", { ...counter, offeredSessions: Number(counter.offeredSessions), requestedSessions: Number(counter.requestedSessions), duration: Number(counter.duration) })}>Send counter</Button></div></Modal>
  <Modal open={Boolean(bookingProposal)} onClose={() => setBookingProposal(null)} title="Schedule accepted proposal"><BookingComposer proposal={bookingProposal || {}} onComplete={() => setBookingProposal(null)} /></Modal>
  </div>;
}

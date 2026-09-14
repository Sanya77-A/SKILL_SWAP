import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarClock, Clock3, MapPin, ShieldAlert, Star, Video } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const statusVariant = { confirmed: "success", upcoming: "accent", in_progress: "warning", requested: "default", completed: "success", cancelled: "danger", disputed: "warning", no_show: "danger" };

export default function BookingsPage() {
  const me = useSelector((state) => state.auth.user);
  const [tab, setTab] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [markingNoShow, setMarkingNoShow] = useState(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [nextStart, setNextStart] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [rule, setRule] = useState({ timezone, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", modes: ["video", "audio"] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "availability") { const response = await api.get("/bookings/availability/me"); setRules(response.data.data || []); }
      else { const response = await api.get("/bookings", { params: { view: tab, limit: 50 } }); setBookings(response.data.data || []); }
    } catch (error) { toast.error(error.response?.data?.message || "Could not load schedule"); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const action = async (booking, name, payload = {}) => {
    try { await api.post(`/bookings/${booking._id}/${name}`, payload); toast.success(name === "confirm" ? "Booking confirmed" : name === "cancel" ? "Booking cancelled" : name === "complete" ? "Booking completed" : name === "no-show" ? "No-show recorded" : "Reschedule requested"); setRescheduling(null); setMarkingNoShow(null); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Action failed"); }
  };
  const saveRules = async (nextRules) => { try { const response = await api.put("/bookings/availability/me", { rules: nextRules }); setRules(response.data.data); toast.success("Availability saved"); } catch (error) { toast.error(error.response?.data?.message || "Could not save availability"); } };
  const addRule = () => saveRules([...rules, { ...rule, dayOfWeek: Number(rule.dayOfWeek), isActive: true }]);

  return <div><header className="mb-6"><h1 className="font-heading text-3xl font-bold text-text-primary">Bookings & availability</h1><p className="mt-1 text-sm text-text-secondary">Times are stored in UTC and shown in your local timezone.</p></header><Tabs value={tab} onChange={setTab}><TabsList className="mb-6"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">History</TabsTrigger><TabsTrigger value="availability">Availability</TabsTrigger></TabsList><TabsContent value="upcoming"><BookingList /></TabsContent><TabsContent value="past"><BookingList /></TabsContent><TabsContent value="availability">{loading ? <Loading /> : <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]"><Card><CardContent className="space-y-4"><h2 className="font-heading text-lg font-semibold text-text-primary">Add weekly hours</h2><Select label="Day" value={rule.dayOfWeek} onChange={(event) => setRule((value) => ({ ...value, dayOfWeek: event.target.value }))} options={days.map((label, value) => ({ value, label }))} /><div className="grid grid-cols-2 gap-3"><Input label="Start" type="time" value={rule.startTime} onChange={(event) => setRule((value) => ({ ...value, startTime: event.target.value }))} /><Input label="End" type="time" value={rule.endTime} onChange={(event) => setRule((value) => ({ ...value, endTime: event.target.value }))} /></div><Input label="Timezone" value={rule.timezone} onChange={(event) => setRule((value) => ({ ...value, timezone: event.target.value }))} /><Button onClick={addRule}>Add hours</Button></CardContent></Card><Card><CardContent><h2 className="mb-4 font-heading text-lg font-semibold text-text-primary">Weekly schedule</h2>{rules.length ? <div className="space-y-3">{rules.map((item, index) => <div key={item._id || `${item.dayOfWeek}-${item.startTime}`} className="flex items-center justify-between rounded-xl border border-border p-3"><div><p className="font-medium text-text-primary">{days[item.dayOfWeek]}</p><p className="text-sm text-text-secondary">{item.startTime} - {item.endTime} · {item.timezone}</p></div><Button size="sm" variant="danger" onClick={() => saveRules(rules.filter((_, ruleIndex) => ruleIndex !== index).map(({ _id, user, createdAt, updatedAt, __v, ...value }) => value))}>Remove</Button></div>)}</div> : <p className="text-sm text-text-secondary">No availability rules. Until you add hours, accepted proposals may request any open slot.</p>}</CardContent></Card></div>}</TabsContent></Tabs>
    <Modal open={Boolean(rescheduling)} onClose={() => setRescheduling(null)} title="Request a new time"><div className="space-y-4"><Input label="New start" type="datetime-local" value={nextStart} onChange={(event) => setNextStart(event.target.value)} /><Button disabled={!nextStart} onClick={() => action(rescheduling, "reschedule", { startAt: new Date(nextStart).toISOString(), timezone })}>Request reschedule</Button></div></Modal>
    <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title="Review completed session"><ReviewForm booking={reviewing} onComplete={() => { setReviewing(null); load(); }} /></Modal>
    <Modal open={Boolean(markingNoShow)} onClose={() => setMarkingNoShow(null)} title="Report a missed session"><div className="space-y-4"><p className="text-sm text-text-secondary">Use this only after the scheduled session has ended and the other participant did not attend. The record can be reviewed through Safety Center.</p><Input label="What happened?" value={noShowReason} maxLength={500} onChange={(event) => setNoShowReason(event.target.value)} placeholder="The participant did not join during the scheduled hour" /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setMarkingNoShow(null)}>Keep session open</Button><Button variant="danger" onClick={() => action(markingNoShow, "no-show", { reason: noShowReason })}>Record no-show</Button></div></div></Modal>
  </div>;

  function Loading() { return <p className="py-12 text-center text-text-secondary" role="status">Loading schedule…</p>; }
  function BookingList() {
    if (loading) return <Loading />;
    if (!bookings.length) return <Card className="p-12 text-center"><CalendarClock className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="text-text-secondary">No {tab} bookings.</p></Card>;
    return <div className="space-y-4">{bookings.map((booking) => { const isTeacher = booking.teacher._id === me?._id; const other = isTeacher ? booking.student : booking.teacher; const localStart = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.startAt)); const ended = new Date(booking.endAt) <= new Date(); return <Card key={booking._id}><CardContent><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="flex gap-3"><Avatar src={other.profilePhoto} name={other.fullName || other.name} size="lg" /><div><div className="flex flex-wrap gap-2"><h2 className="font-medium text-text-primary">{booking.skill.name} with {other.fullName || other.name}</h2><Badge variant={statusVariant[booking.status]}>{booking.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-sm text-text-secondary"><Clock3 className="mr-1 inline h-4 w-4" />{localStart} · {booking.duration} min</p><p className="mt-1 text-sm text-text-secondary">{booking.mode === "in_person" ? <MapPin className="mr-1 inline h-4 w-4" /> : <Video className="mr-1 inline h-4 w-4" />}{booking.mode.replaceAll("_", " ")} · {isTeacher ? "Teaching" : "Learning"}</p></div></div><div className="flex flex-wrap items-start gap-2">{booking.status === "requested" && booking.confirmationRequiredBy === me?._id && <Button size="sm" onClick={() => action(booking, "confirm")}>Confirm</Button>}{["requested", "confirmed", "upcoming"].includes(booking.status) && <><Button size="sm" variant="secondary" onClick={() => { setNextStart(""); setRescheduling(booking); }}>Reschedule</Button><Button size="sm" variant="danger" onClick={() => action(booking, "cancel", { reason: "Cancelled by participant" })}>Cancel</Button></>}{["confirmed", "upcoming", "in_progress"].includes(booking.status) && <Button asChild size="sm" variant="secondary"><Link to={`/safety?bookingId=${booking._id}`}><ShieldAlert className="h-4 w-4" />Dispute</Link></Button>}{["confirmed", "upcoming", "in_progress"].includes(booking.status) && ended && <><Button size="sm" onClick={() => action(booking, "complete")}>Mark complete</Button><Button size="sm" variant="danger" onClick={() => { setNoShowReason(""); setMarkingNoShow(booking); }}>Report no-show</Button></>}{booking.status === "completed" && !booking.reviewedByMe && <Button size="sm" onClick={() => setReviewing(booking)}><Star className="mr-1 h-4 w-4" />Review</Button>}{booking.reviewedByMe && <Badge variant="success">Reviewed</Badge>}</div></div></CardContent></Card>; })}</div>;
  }
}

const reviewCategories = ["communication", "knowledge", "teaching", "punctuality", "professionalism", "overall"];

function ReviewForm({ booking, onComplete }) {
  const [ratings, setRatings] = useState(Object.fromEntries(reviewCategories.map((category) => [category, 5])));
  const [comment, setComment] = useState("");
  const [wouldLearnAgain, setWouldLearnAgain] = useState(true);
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await api.post("/reviews", { sessionId: booking._id, ratings, comment, wouldLearnAgain }); toast.success("Review published"); onComplete(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not publish review"); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="space-y-4"><p className="text-sm text-text-secondary">Rate your verified session for {booking?.skill?.name}. Ratings are public and cannot be edited.</p><div className="grid grid-cols-2 gap-3">{reviewCategories.map((category) => <Select key={category} label={category[0].toUpperCase() + category.slice(1)} value={ratings[category]} onChange={(event) => setRatings((value) => ({ ...value, [category]: Number(event.target.value) }))} options={[5, 4, 3, 2, 1].map((value) => ({ value, label: `${value} / 5` }))} />)}</div><div><label className="mb-1.5 block text-sm font-medium text-text-secondary">Comment</label><textarea aria-label="Review comment" rows={4} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text-primary" /></div><label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={wouldLearnAgain} onChange={(event) => setWouldLearnAgain(event.target.checked)} />I would learn with this person again</label><Button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish verified review"}</Button></form>;
}

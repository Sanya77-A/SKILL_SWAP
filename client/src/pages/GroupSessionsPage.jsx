import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Clock3, Coins, MapPin, PlayCircle, Plus, Users, Video } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";

const initialForm = { title: "", skillId: "", description: "", startAt: "", duration: 60, capacity: 10, creditCost: 0, price: 0, currency: "USD", mode: "video", meetingUrl: "", locationDetails: "" };
const tones = { draft: "default", published: "accent", full: "warning", in_progress: "success", completed: "success", cancelled: "danger" };
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function GroupSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [mine, setMine] = useState([]);
  const [teachingSkills, setTeachingSkills] = useState([]);
  const [view, setView] = useState("discover");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const load = async () => {
    setLoading(true);
    try {
      const [publicResponse, mineResponse, skillResponse] = await Promise.all([
        api.get("/group-sessions", { params: { limit: 50 } }),
        api.get("/group-sessions", { params: { mine: true, limit: 50 } }),
        api.get("/user-skills/me"),
      ]);
      setSessions(publicResponse.data.data || []);
      setMine(mineResponse.data.data || []);
      const teachable = (skillResponse.data.data || []).filter((item) => item.teachingEnabled && item.skill?.status === "active");
      setTeachingSkills(teachable);
      if (teachable.length) setForm((current) => ({ ...current, skillId: current.skillId || teachable[0].skill._id }));
    } catch (error) { toast.error(error.response?.data?.message || "Could not load group sessions"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.post("/group-sessions", { ...form, startAt: new Date(form.startAt).toISOString(), duration: Number(form.duration), capacity: Number(form.capacity), creditCost: Number(form.creditCost), price: Number(form.price), timezone });
      setForm({ ...initialForm, skillId: teachingSkills[0]?.skill?._id || "" }); setShowCreate(false); setView("hosting"); await load(); toast.success("Draft group session created");
    } catch (error) { toast.error(error.response?.data?.message || "Could not create group session"); }
    finally { setBusy(false); }
  };
  const act = async (id, action, success) => {
    setBusy(true);
    try { await api.post(`/group-sessions/${id}/${action}`); await load(); toast.success(success); }
    catch (error) { toast.error(error.response?.data?.message || "Group-session action failed"); }
    finally { setBusy(false); }
  };
  const displayed = useMemo(() => view === "hosting" ? mine : sessions, [view, mine, sessions]);

  if (loading) return <div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-10 w-64 rounded-xl bg-surface-2" /><div className="grid gap-4 md:grid-cols-2"><div className="h-56 rounded-2xl bg-surface-2" /><div className="h-56 rounded-2xl bg-surface-2" /></div></div>;
  return <div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Users className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Group Sessions</h1></div><p className="mt-1 text-sm text-text-secondary">Join focused mentor-led workshops with capacity-safe enrollment.</p></div><Button onClick={() => setShowCreate((value) => !value)} disabled={!teachingSkills.length} title={!teachingSkills.length ? "Add a skill you teach before hosting" : undefined}><Plus className="h-4 w-4" />Host a session</Button></header>{!teachingSkills.length && <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">To host, add a canonical teaching skill to your profile.</p>}{showCreate && <Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Create a group-session draft</h2></CardHeader><CardContent><form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} minLength={3} maxLength={180} required /><Select label="Skill" value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} options={teachingSkills.map((item) => ({ value: item.skill._id, label: item.skill.name }))} /><Input label="Starts" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} required /><Input label="Duration (minutes)" type="number" min="15" max="480" step="15" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /><Input label="Capacity" type="number" min="2" max="500" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /><Select label="Mode" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} options={[{ value: "video", label: "Video" }, { value: "in_person", label: "In person" }, { value: "hybrid", label: "Hybrid" }]} /><Input label="SkillCredits" type="number" min="0" value={form.creditCost} onChange={(event) => setForm({ ...form, creditCost: event.target.value, price: 0 })} /><Input label="Price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value, creditCost: 0 })} /><Input label="Currency" value={form.currency} maxLength={3} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />{["video", "hybrid"].includes(form.mode) && <Input label="Meeting URL" type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} required={form.mode === "video"} />}{["in_person", "hybrid"].includes(form.mode) && <Input label="Location" value={form.locationDetails} onChange={(event) => setForm({ ...form, locationDetails: event.target.value })} required={form.mode === "in_person"} />}<div className="sm:col-span-2 lg:col-span-3"><label className="mb-1.5 block text-sm font-medium text-text-secondary">Description</label><textarea aria-label="Group-session description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} minLength={10} maxLength={4000} required className="min-h-24 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text-primary" /></div><div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={busy || !form.startAt || !form.skillId}>Create draft</Button></div></form></CardContent></Card>}<div className="flex gap-2"><Button variant={view === "discover" ? "primary" : "secondary"} onClick={() => setView("discover")}>Discover</Button><Button variant={view === "hosting" ? "primary" : "secondary"} onClick={() => setView("hosting")}>Hosting ({mine.length})</Button></div><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{displayed.length ? displayed.map((session) => { const seats = Math.max(0, session.capacity - session.participantCount); return <Card key={session._id} className="flex flex-col"><CardContent className="flex flex-1 flex-col"><div className="flex items-start justify-between gap-2"><Badge variant={tones[session.status]}>{session.status.replace("_", " ")}</Badge><span className="text-xs text-text-secondary">{seats} seats left</span></div><h2 className="mt-3 font-heading text-xl font-semibold text-text-primary">{session.title}</h2><p className="mt-1 text-sm text-accent">{session.skill?.name}</p><p className="mt-3 line-clamp-3 text-sm text-text-secondary">{session.description}</p><div className="mt-4 space-y-2 text-sm text-text-secondary"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatDate(session.startAt)}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{session.duration} minutes · {session.timezone}</p><p className="flex items-center gap-2">{session.mode === "video" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{session.mode.replace("_", " ")}</p><p className="flex items-center gap-2"><Coins className="h-4 w-4" />{session.creditCost ? `${session.creditCost} SkillCredits` : session.price ? `${session.currency} ${session.price}` : "Free"}</p></div>{session.mentor && <div className="mt-4 flex items-center gap-2 border-t border-border pt-3"><Avatar src={session.mentor.profilePhoto} name={session.mentor.name} size="sm" /><div><p className="text-sm font-medium text-text-primary">{session.mentor.name}</p><p className="text-xs text-text-secondary">{session.mentor.headline || "Session mentor"}</p></div></div>}<div className="mt-auto flex flex-wrap gap-2 pt-4">{view === "hosting" ? <>{session.status === "draft" && <Button size="sm" disabled={busy} onClick={() => act(session._id, "publish", "Session published")}>Publish</Button>}{["draft", "published", "full"].includes(session.status) && <Button size="sm" variant="danger" disabled={busy} onClick={() => act(session._id, "cancel", "Session cancelled")}>Cancel</Button>}{["published", "full"].includes(session.status) && new Date(session.startAt) <= new Date() && <Button size="sm" variant="success" disabled={busy} onClick={() => act(session._id, "start", "Session started")}><PlayCircle className="h-4 w-4" />Start</Button>}{session.status === "in_progress" && new Date(session.endAt) <= new Date() && <Button size="sm" variant="success" disabled={busy} onClick={() => act(session._id, "complete", "Session completed")}>Complete</Button>}</> : session.enrolled ? <Button size="sm" variant="secondary" disabled={busy || new Date(session.startAt) <= new Date()} onClick={() => act(session._id, "withdraw", "Enrollment cancelled")}>Withdraw</Button> : <Button size="sm" disabled={busy || !["published"].includes(session.status) || session.price > 0} onClick={() => act(session._id, "enroll", "You’re enrolled")}>{session.price > 0 ? "Paid checkout unavailable" : session.status === "full" ? "Full" : "Enroll"}</Button>}</div></CardContent></Card>; }) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-text-secondary">{view === "hosting" ? "You are not hosting any group sessions." : "No group sessions are currently available."}</CardContent></Card>}</section></div>;
}

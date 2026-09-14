import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarDays, Check, Circle, Map, Pause, Play, Plus, Sparkles, UserRound } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
const statusTone = { active: "accent", paused: "warning", completed: "success", archived: "default", draft: "default" };

export default function RoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [targetSkillId, setTargetSkillId] = useState("");
  const [goal, setGoal] = useState("");
  const [targetDate, setTargetDate] = useState(() => new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
  const [editGoal, setEditGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDetail = async (id) => {
    const { data } = await api.get(`/roadmaps/${id}`);
    setSelected(data.data);
    setEditGoal(data.data.goal);
  };
  const load = async () => {
    setLoading(true);
    try {
      const [roadmapResponse, skillResponse] = await Promise.all([api.get("/roadmaps", { params: { limit: 50 } }), api.get("/skills", { params: { limit: 50, sort: "name", order: "asc" } })]);
      const items = roadmapResponse.data.data || [];
      const catalog = skillResponse.data.data || [];
      setRoadmaps(items); setSkills(catalog);
      if (catalog.length) setTargetSkillId((current) => current || catalog[0]._id);
      if (items.length) await loadDetail(items[0]._id);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load roadmaps"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sync = (data) => {
    setSelected(data); setEditGoal(data.goal);
    setRoadmaps((current) => [data, ...current.filter((item) => item._id !== data._id)]);
  };
  const generate = async (event) => {
    event.preventDefault();
    if (!targetSkillId || goal.trim().length < 10) return;
    setSaving(true);
    try {
      const { data } = await api.post("/roadmaps/generate", { targetSkillId, goal: goal.trim(), targetDate: new Date(`${targetDate}T23:59:59`).toISOString() });
      sync(data.data); setGoal(""); toast.success("Roadmap created");
    } catch (error) { toast.error(error.response?.data?.message || "Could not generate roadmap"); }
    finally { setSaving(false); }
  };
  const mutate = async (request, message) => {
    setSaving(true);
    try { const { data } = await request(); sync(data.data); if (message) toast.success(message); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update roadmap"); }
    finally { setSaving(false); }
  };
  const tasksByMilestone = useMemo(() => {
    const map = new globalThis.Map();
    for (const task of selected?.tasks || []) map.set(task.milestone, [...(map.get(task.milestone) || []), task]);
    return map;
  }, [selected]);

  if (loading) return <div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-10 w-64 rounded-xl bg-surface-2" /><div className="h-72 rounded-2xl bg-surface-2" /></div>;

  return <div className="mx-auto max-w-7xl space-y-6"><header><div className="flex items-center gap-2"><Map className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Learning Roadmaps</h1></div><p className="mt-1 text-sm text-text-secondary">Create an editable plan, complete real tasks, and let the server calculate your progress.</p></header><Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Create a roadmap</h2><p className="mt-1 text-sm text-text-secondary">AI can enrich the initial structure when configured; deterministic generation is always available.</p></CardHeader><CardContent><form onSubmit={generate} className="grid gap-4 lg:grid-cols-[1fr_2fr_1fr_auto] lg:items-end"><Select label="Target skill" value={targetSkillId} onChange={(event) => setTargetSkillId(event.target.value)} options={skills.map((skill) => ({ value: skill._id, label: skill.name }))} placeholder="Choose a canonical skill" /><Input label="Goal" value={goal} onChange={(event) => setGoal(event.target.value)} minLength={10} maxLength={1000} placeholder="Build enough confidence to ship a production project" /><Input label="Target date" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /><Button type="submit" disabled={saving || !targetSkillId || goal.trim().length < 10}><Sparkles className="h-4 w-4" />Generate</Button></form></CardContent></Card><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><Card className="h-fit"><CardHeader><h2 className="font-heading font-semibold text-text-primary">Your roadmaps</h2></CardHeader><CardContent className="space-y-2 p-3">{roadmaps.length ? roadmaps.map((item) => <button key={item._id} onClick={() => loadDetail(item._id).catch(() => toast.error("Could not open roadmap"))} className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?._id === item._id ? "border-accent bg-accent/10" : "border-border bg-surface-2 hover:border-accent"}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium text-text-primary">{item.targetSkill?.name}</p><Badge variant={statusTone[item.status]}>{item.status}</Badge></div><p className="mt-2 text-xs text-text-secondary">{item.progress}% complete · {item.milestones?.length || 0} milestones</p></button>) : <p className="p-3 text-sm text-text-secondary">No roadmaps yet.</p>}</CardContent></Card>{selected ? <div className="space-y-5"><Card><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-2xl font-bold text-text-primary">{selected.targetSkill?.name}</h2><Badge variant={statusTone[selected.status]}>{selected.status}</Badge><Badge variant="default">{selected.generationSource === "ai_enriched" ? "AI enriched" : "Deterministic"}</Badge></div><p className="mt-2 flex items-center gap-1 text-sm text-text-secondary"><CalendarDays className="h-4 w-4" />{formatDate(selected.startDate)} - {formatDate(selected.targetDate)}</p></div><div className="flex gap-2">{["active", "paused"].includes(selected.status) && <Button size="sm" variant="secondary" disabled={saving} onClick={() => mutate(() => api.patch(`/roadmaps/${selected._id}`, { status: selected.status === "paused" ? "active" : "paused" }))}>{selected.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{selected.status === "paused" ? "Resume" : "Pause"}</Button>}</div></div><div className="mt-5"><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Progress</span><span className="font-semibold text-accent">{selected.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${selected.progress}%` }} /></div></div><div className="mt-5 flex gap-2"><input value={editGoal} onChange={(event) => setEditGoal(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary" aria-label="Roadmap goal" /><Button size="sm" variant="secondary" disabled={saving || editGoal.trim().length < 10 || editGoal === selected.goal} onClick={() => mutate(() => api.patch(`/roadmaps/${selected._id}`, { goal: editGoal.trim() }), "Goal updated")}>Save goal</Button></div></CardContent></Card><div className="space-y-4">{[...selected.milestones].sort((a, b) => a.order - b.order).map((milestone, index) => { const tasks = [...(tasksByMilestone.get(milestone._id) || [])].sort((a, b) => a.order - b.order); return <Card key={milestone._id}><CardHeader className="flex-row items-start justify-between gap-3"><div className="flex gap-3"><button disabled={saving} onClick={() => mutate(() => api.post(`/roadmaps/${selected._id}/milestones/${milestone._id}/complete`, { completed: milestone.status !== "completed" }))} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${milestone.status === "completed" ? "border-accent-2 bg-accent-2 text-on-accent" : "border-border text-text-secondary"}`} aria-label={`${milestone.status === "completed" ? "Reopen" : "Complete"} ${milestone.title}`}>{milestone.status === "completed" ? <Check className="h-4 w-4" /> : index + 1}</button><div><h3 className="font-heading font-semibold text-text-primary">{milestone.title}</h3><p className="mt-1 text-sm text-text-secondary">{milestone.description}</p></div></div>{milestone.targetDate && <span className="shrink-0 text-xs text-text-secondary">{formatDate(milestone.targetDate)}</span>}</CardHeader><CardContent className="space-y-2">{tasks.map((task) => <label key={task._id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3"><input type="checkbox" checked={task.status === "completed"} disabled={saving} onChange={(event) => mutate(() => api.patch(`/roadmaps/${selected._id}/tasks/${task._id}`, { completed: event.target.checked }))} className="sr-only" /><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${task.status === "completed" ? "border-accent-2 bg-accent-2 text-on-accent" : "border-border"}`}>{task.status === "completed" ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3 text-text-secondary" />}</span><span><span className={`block text-sm font-medium ${task.status === "completed" ? "text-text-secondary line-through" : "text-text-primary"}`}>{task.title}</span>{task.description && <span className="mt-0.5 block text-xs text-text-secondary">{task.description}</span>}</span></label>)}</CardContent></Card>; })}</div>{selected.mentorRecommendations?.length > 0 && <Card><CardHeader><h2 className="flex items-center gap-2 font-heading font-semibold text-text-primary"><UserRound className="h-5 w-5 text-accent" />Recommended mentors</h2></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{selected.mentorRecommendations.map((item) => <Link key={`${item.user}-${item.skill}`} to={`/user/${item.user}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 hover:border-accent"><Avatar src={item.mentor?.profilePhoto} name={item.mentor?.name || "Mentor"} /><div className="min-w-0 flex-1"><p className="truncate font-medium text-text-primary">{item.mentor?.name || "Available mentor"}</p><p className="text-xs text-text-secondary">{item.skillName} · {item.suitabilityScore}% fit</p></div></Link>)}</CardContent></Card>}</div> : <Card><CardContent className="py-16 text-center"><Plus className="mx-auto h-10 w-10 text-text-secondary" /><p className="mt-3 text-text-secondary">Generate a roadmap to begin.</p></CardContent></Card>}</div></div>;
}

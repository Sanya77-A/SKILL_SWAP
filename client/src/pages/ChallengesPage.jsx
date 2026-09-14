import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Award, CalendarDays, CheckCircle2, Coins, ExternalLink, Flame, LockKeyhole, Sparkles, Star, Target, Trophy } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

const DAY_MS = 86_400_000;
const statusTone = { active: "accent", completed: "success", abandoned: "danger" };
const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function Progress({ value }) {
  return <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value}%` }} /></div>;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState([]);
  const [xp, setXp] = useState({ totalXp: 0, events: 0, recent: [] });
  const [selected, setSelected] = useState(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const dialogOpen = Boolean(selected);

  const load = async () => {
    setLoading(true);
    try {
      const [challengeResponse, xpResponse] = await Promise.all([api.get("/challenges", { params: { limit: 50 } }), api.get("/challenges/xp/me")]);
      setChallenges(challengeResponse.data.data || []);
      setXp(xpResponse.data.data || { totalXp: 0, events: 0, recent: [] });
    } catch (error) { toast.error(error.response?.data?.message || "Could not load challenges"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...(dialog?.querySelectorAll(selector) || [])]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [dialogOpen]);

  const open = async (id) => {
    try { setSelected((await api.get(`/challenges/${id}`)).data.data); setEvidenceUrl(""); setNote(""); }
    catch (error) { toast.error(error.response?.data?.message || "Could not open challenge"); }
  };
  const act = async (request, success, reopen = true) => {
    setBusy(true);
    try {
      await request();
      await load();
      if (reopen && selected?._id) await open(selected._id);
      toast.success(success);
    } catch (error) { toast.error(error.response?.data?.message || "Challenge action failed"); }
    finally { setBusy(false); }
  };
  const enroll = async (challenge) => {
    setSelected(challenge);
    setBusy(true);
    try {
      await api.post(`/challenges/${challenge._id}/enroll`);
      await load();
      await open(challenge._id);
      toast.success("Challenge started");
    } catch (error) { toast.error(error.response?.data?.message || "Could not start challenge"); }
    finally { setBusy(false); }
  };

  const enrolledCount = useMemo(() => challenges.filter((item) => item.myEnrollment).length, [challenges]);
  const activeCount = useMemo(() => challenges.filter((item) => item.myEnrollment?.status === "active").length, [challenges]);
  const enrollment = selected?.myEnrollment;
  const completions = selected?.myCompletions || [];
  const nextDay = enrollment?.status === "active" ? enrollment.progressDays + 1 : null;
  const nextTask = selected?.dailyTasks?.find((item) => item.day === nextDay);
  const unlockAt = enrollment && nextDay ? new Date(new Date(enrollment.startedAt).getTime() + (nextDay - 1) * DAY_MS) : null;
  const locked = unlockAt ? unlockAt > new Date() : false;

  if (loading) return <div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-32 rounded-3xl bg-surface-2" /><div className="grid gap-4 md:grid-cols-3"><div className="h-52 rounded-2xl bg-surface-2" /><div className="h-52 rounded-2xl bg-surface-2" /><div className="h-52 rounded-2xl bg-surface-2" /></div></div>;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/15 via-surface to-accent-2/10 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-accent"><Trophy className="h-6 w-6" /><span className="text-sm font-semibold uppercase tracking-[0.18em]">Practice with purpose</span></div><h1 className="font-heading text-3xl font-bold text-text-primary sm:text-4xl">Skill Challenges</h1><p className="mt-2 max-w-2xl text-text-secondary">Build a real habit through one rule-based task per day. XP, credits, and badges are earned only by completing the published work.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-border bg-surface/80 px-4 py-3"><p className="text-2xl font-bold text-text-primary">{xp.totalXp}</p><p className="text-xs text-text-secondary">Total XP</p></div><div className="rounded-2xl border border-border bg-surface/80 px-4 py-3"><p className="text-2xl font-bold text-text-primary">{activeCount}</p><p className="text-xs text-text-secondary">Active</p></div><div className="rounded-2xl border border-border bg-surface/80 px-4 py-3"><p className="text-2xl font-bold text-text-primary">{enrolledCount}</p><p className="text-xs text-text-secondary">Joined</p></div></div>
      </div>
    </header>

    <section><div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading text-xl font-semibold text-text-primary">Available challenges</h2><p className="text-sm text-text-secondary">Every reward is visible before you enroll.</p></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{challenges.length ? challenges.map((challenge) => { const mine = challenge.myEnrollment; return <Card key={challenge._id} className="group flex flex-col transition-transform hover:-translate-y-0.5"><CardContent className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><Badge variant="accent">{challenge.skill?.name}</Badge>{mine && <Badge variant={statusTone[mine.status]}>{mine.status}</Badge>}</div><h3 className="mt-4 font-heading text-xl font-semibold text-text-primary">{challenge.title}</h3><p className="mt-2 line-clamp-3 text-sm text-text-secondary">{challenge.description}</p><div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-surface-2 p-2"><CalendarDays className="mx-auto mb-1 h-4 w-4 text-accent" /><span>{challenge.durationDays} days</span></div><div className="rounded-xl bg-surface-2 p-2"><Star className="mx-auto mb-1 h-4 w-4 text-warning" /><span>{challenge.dailyTasks.reduce((sum, task) => sum + task.xp, challenge.completionBonusXp)} XP</span></div><div className="rounded-xl bg-surface-2 p-2"><Coins className="mx-auto mb-1 h-4 w-4 text-accent-2" /><span>{challenge.rewardCredits} credits</span></div></div>{mine && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-text-secondary"><span>{mine.progressDays}/{challenge.durationDays} days</span><span>{mine.progress}%</span></div><Progress value={mine.progress} /></div>}<div className="mt-auto flex gap-2 pt-5"><Button className="flex-1" variant={mine ? "secondary" : "primary"} onClick={() => open(challenge._id)}>{mine ? "View progress" : "View challenge"}</Button>{!mine && <Button onClick={() => enroll(challenge)} disabled={busy}>Start</Button>}</div></CardContent></Card>; }) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-text-secondary">No published challenges are available yet.</CardContent></Card>}</div>
    </section>

    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label={selected.title} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-border bg-background p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><Badge variant="accent">{selected.skill?.name}</Badge><h2 className="mt-3 font-heading text-2xl font-bold text-text-primary">{selected.title}</h2><p className="mt-2 text-sm text-text-secondary">{selected.description}</p></div><Button variant="ghost" onClick={() => setSelected(null)} aria-label="Close challenge">Close</Button></div>
      <div className="my-6 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-surface p-3"><CalendarDays className="mb-2 h-5 w-5 text-accent" /><p className="font-semibold text-text-primary">{selected.durationDays} days</p><p className="text-xs text-text-secondary">One task daily</p></div><div className="rounded-2xl bg-surface p-3"><Sparkles className="mb-2 h-5 w-5 text-warning" /><p className="font-semibold text-text-primary">{selected.dailyTasks.reduce((sum, task) => sum + task.xp, selected.completionBonusXp)} XP</p><p className="text-xs text-text-secondary">Includes {selected.completionBonusXp} bonus</p></div><div className="rounded-2xl bg-surface p-3"><Coins className="mb-2 h-5 w-5 text-accent-2" /><p className="font-semibold text-text-primary">{selected.rewardCredits} credits</p><p className="text-xs text-text-secondary">On full completion</p></div><div className="rounded-2xl bg-surface p-3"><Award className="mb-2 h-5 w-5 text-accent" /><p className="font-semibold text-text-primary">{selected.badge.title}</p><p className="text-xs text-text-secondary">Completion badge</p></div></div>
      {!enrollment ? <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5 text-center"><Target className="mx-auto h-8 w-8 text-accent" /><p className="mt-2 font-medium text-text-primary">Ready for a focused {selected.durationDays}-day commitment?</p><p className="mt-1 text-sm text-text-secondary">Tasks unlock every 24 hours. You can complete only one challenge day per UTC day.</p><Button className="mt-4" disabled={busy} onClick={() => enroll(selected)}>Enroll and start day 1</Button></div> : <>
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]"><div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-text-primary">{enrollment.progressDays} of {selected.durationDays} days complete</span><span className="text-text-secondary">{enrollment.progress}%</span></div><Progress value={enrollment.progress} /></div><div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-2"><Flame className="h-5 w-5 text-warning" /><div><p className="font-semibold text-text-primary">{enrollment.currentStreak} day streak</p><p className="text-xs text-text-secondary">Best: {enrollment.longestStreak}</p></div></div></div>
        {enrollment.status === "completed" && <div className="mb-5 rounded-2xl border border-accent-2/30 bg-accent-2/10 p-5"><div className="flex items-center gap-3"><Trophy className="h-9 w-9 text-accent-2" /><div><h3 className="font-heading text-lg font-semibold text-text-primary">Challenge complete</h3><p className="text-sm text-text-secondary">You earned {enrollment.xp} XP, {selected.rewardCredits} SkillCredits, and the {selected.badge.title} badge.</p></div></div></div>}
        {nextTask && <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/5 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent">Next · Day {nextTask.day}</p><h3 className="mt-1 font-heading text-lg font-semibold text-text-primary">{nextTask.title}</h3></div><Badge variant="warning">+{nextTask.xp} XP</Badge></div><p className="mt-2 text-sm text-text-secondary">{nextTask.description}</p>{locked ? <p className="mt-4 flex items-center gap-2 text-sm text-warning"><LockKeyhole className="h-4 w-4" />Unlocks {dateLabel(unlockAt)}</p> : <div className="mt-4 space-y-3">{nextTask.evidenceRequired && <Input label="Evidence URL" type="url" placeholder="https://…" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} required />}<div><label className="mb-1.5 block text-sm font-medium text-text-secondary">Reflection note <span className="font-normal">(optional)</span></label><textarea aria-label="Reflection note" className="min-h-20 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-text-primary" maxLength={1500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you practice or learn?" /></div><Button disabled={busy || (nextTask.evidenceRequired && !evidenceUrl)} onClick={() => act(() => api.post(`/challenges/${selected._id}/days/${nextTask.day}/complete`, { evidenceUrl, note }), `Day ${nextTask.day} complete · +${nextTask.xp} XP`)}><CheckCircle2 className="h-4 w-4" />Complete day {nextTask.day}</Button></div>}</div>}
        <ol className="space-y-2">{selected.dailyTasks.map((task) => { const done = completions.find((item) => item.day === task.day); const isNext = task.day === nextDay; return <li key={task.day} className={`rounded-xl border p-3 ${done ? "border-accent-2/30 bg-accent-2/5" : isNext ? "border-accent/30" : "border-border bg-surface/50"}`}><div className="flex items-start gap-3">{done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-2" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-text-secondary">{task.day}</span>}<div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-medium text-text-primary">{task.title}</p><span className="shrink-0 text-xs text-text-secondary">{task.xp} XP</span></div><p className="mt-0.5 text-xs text-text-secondary">{task.description}</p>{done?.evidenceUrl && <a href={done.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent">Evidence <ExternalLink className="h-3 w-3" /></a>}</div></div></li>; })}</ol>
        {enrollment.status === "active" && <div className="mt-6 border-t border-border pt-4"><Button variant="ghost" disabled={busy} onClick={() => act(() => api.post(`/challenges/${selected._id}/abandon`), "Challenge left")}>Leave challenge</Button></div>}
      </>}
    </section></div>}
  </div>;
}

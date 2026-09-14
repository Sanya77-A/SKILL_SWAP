import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { BrainCircuit, CheckCircle2, ChevronRight, CircleAlert, Sparkles, Target, UserRoundSearch } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Select";

const levelTone = { Beginner: "default", Intermediate: "accent", Advanced: "warning", Expert: "success", None: "danger" };

function RequirementList({ title, description, items, empty, tone = "accent" }) {
  return <Card><CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">{title}</h2><p className="mt-1 text-sm text-text-secondary">{description}</p></CardHeader><CardContent className="space-y-3">{items.length ? items.map((item) => <div key={item.skill} className="rounded-xl border border-border bg-surface-2 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs font-semibold text-text-secondary">{item.priority}</span><p className="font-medium text-text-primary">{item.name}</p></div><Badge variant={tone}>{item.importance}</Badge></div><div className="mt-2 flex flex-wrap gap-2"><Badge variant={levelTone[item.currentProficiency]}>Current: {item.currentProficiency}</Badge><Badge variant="accent">Target: {item.requiredProficiency}</Badge></div>{item.rationale && <p className="mt-2 text-xs text-text-secondary">{item.rationale}</p>}</div>) : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">{empty}</p>}</CardContent></Card>;
}

export default function SkillGapPage() {
  const [paths, setPaths] = useState([]);
  const [careerPathId, setCareerPathId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    api.get("/career-paths", { params: { limit: 50 } }).then(({ data }) => {
      setPaths(data.data || []);
      if (data.data?.length) setCareerPathId(data.data[0]._id);
    }).catch((error) => toast.error(error.response?.data?.message || "Could not load career goals")).finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => paths.find((path) => path._id === careerPathId), [paths, careerPathId]);
  const runAnalysis = async () => {
    if (!careerPathId || analyzing) return;
    setAnalyzing(true);
    try {
      const { data } = await api.post("/skill-gaps/analyze", { careerPathId });
      setAnalysis(data.data);
      toast.success("Skill-gap analysis updated");
    } catch (error) { toast.error(error.response?.data?.message || "Could not analyze this career goal"); }
    finally { setAnalyzing(false); }
  };

  if (loading) return <div className="mx-auto max-w-6xl animate-pulse space-y-4"><div className="h-10 w-64 rounded-xl bg-surface-2" /><div className="h-52 rounded-2xl bg-surface-2" /></div>;

  return <div className="mx-auto max-w-6xl space-y-6"><header><div className="flex items-center gap-2"><Target className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Career Skill Gap</h1></div><p className="mt-1 text-sm text-text-secondary">Compare your recorded skills with a versioned, canonical career framework.</p></header><Card><CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><Select label="Career goal" value={careerPathId} onChange={(event) => { setCareerPathId(event.target.value); setAnalysis(null); }} options={paths.map((path) => ({ value: path._id, label: path.title }))} placeholder={paths.length ? "Select a goal" : "No active career goals"} disabled={!paths.length || analyzing} />{selected && <p className="mt-2 text-sm text-text-secondary">{selected.description || `${selected.requiredSkills.length} required canonical skills`} · Framework v{selected.version}</p>}</div><Button onClick={runAnalysis} disabled={!careerPathId || analyzing}><BrainCircuit className="mr-2 h-4 w-4" />{analyzing ? "Analyzing…" : "Analyze my skills"}</Button></CardContent></Card>{!paths.length && <Card><CardContent className="py-10 text-center"><Target className="mx-auto h-10 w-10 text-text-secondary" /><h2 className="mt-3 font-heading text-lg font-semibold text-text-primary">Career frameworks are being prepared</h2><p className="mt-1 text-sm text-text-secondary">An administrator must publish at least one canonical career path before analysis is available.</p></CardContent></Card>}{analysis && <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent><p className="text-xs uppercase tracking-wide text-text-secondary">Recorded skills</p><p className="mt-2 text-3xl font-bold text-text-primary">{analysis.actualSkillSnapshot.length}</p></CardContent></Card><Card><CardContent><p className="text-xs uppercase tracking-wide text-text-secondary">Required skills</p><p className="mt-2 text-3xl font-bold text-text-primary">{analysis.requiredSkillSnapshot.length}</p></CardContent></Card><Card><CardContent><p className="text-xs uppercase tracking-wide text-text-secondary">Missing</p><p className="mt-2 text-3xl font-bold text-danger">{analysis.missingSkills.length}</p></CardContent></Card><Card><CardContent><p className="text-xs uppercase tracking-wide text-text-secondary">Below target</p><p className="mt-2 text-3xl font-bold text-warning">{analysis.weakSkills.length}</p></CardContent></Card></section><Card className="border-accent/30 bg-accent/5"><CardContent className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading font-semibold text-text-primary">Advisory narrative</h2><Badge variant="default">{analysis.narrativeProvider === "grounded_fallback" ? "Deterministic" : "AI generated"}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{analysis.generatedNarrative}</p><p className="mt-2 text-xs text-text-secondary">This narrative never changes your recorded skills or authoritative gap results.</p></div></CardContent></Card><div className="grid gap-5 lg:grid-cols-2"><RequirementList title="Missing skills" description="Not present in your current canonical skill records." items={analysis.missingSkills} empty="No required skills are missing." tone="danger" /><RequirementList title="Weak skills" description="Recorded, but below the framework’s target proficiency." items={analysis.weakSkills} empty="No recorded skills are below target." tone="warning" /></div><Card><CardHeader><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-accent-2" /><h2 className="font-heading text-lg font-semibold text-text-primary">Actual skill state</h2></div><p className="mt-1 text-sm text-text-secondary">A server-recorded snapshot, separate from generated guidance.</p></CardHeader><CardContent><div className="flex flex-wrap gap-2">{analysis.actualSkillSnapshot.length ? analysis.actualSkillSnapshot.map((item) => <div key={item.userSkill} className="rounded-xl border border-border bg-surface-2 px-3 py-2"><p className="text-sm font-medium text-text-primary">{item.name}</p><div className="mt-1 flex gap-1"><Badge variant={levelTone[item.proficiency]}>{item.proficiency}</Badge><Badge variant={item.verificationStatus === "verified" ? "success" : "default"}>{item.verificationStatus}</Badge></div></div>) : <p className="text-sm text-text-secondary">No canonical skills are recorded yet. Add them from your profile.</p>}</div></CardContent></Card><Card><CardHeader><div className="flex items-center gap-2"><UserRoundSearch className="h-5 w-5 text-accent" /><h2 className="font-heading text-lg font-semibold text-text-primary">Suitable mentors</h2></div><p className="mt-1 text-sm text-text-secondary">Ranked only from active, visible mentors who teach a missing or weak skill.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{analysis.mentorRecommendations.length ? analysis.mentorRecommendations.map((item) => <Link key={`${item.user}-${item.skill}`} to={`/user/${item.user}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 hover:border-accent"><Avatar src={item.mentor?.profilePhoto} name={item.mentor?.name || "Mentor"} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-text-primary">{item.mentor?.name || "Available mentor"}</p><span className="text-sm font-semibold text-accent">{item.suitabilityScore}%</span></div><p className="text-xs text-text-secondary">{item.skillName} · {item.reasons?.slice(0, 2).join(" · ")}</p></div><ChevronRight className="h-4 w-4 text-text-secondary" /></Link>) : <div className="col-span-full flex gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary"><CircleAlert className="h-5 w-5 shrink-0" />No eligible mentor currently teaches the recommended skills.</div>}</CardContent></Card></> }</div>;
}

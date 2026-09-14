import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Archive, ExternalLink, FolderKanban, Github, Plus, Rocket, Star } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

const emptyForm = { title: "", description: "", skillIds: [], role: "", projectUrl: "", repositoryUrl: "", imageUrl: "", outcomes: "", startedAt: "", completedAt: "", featured: false };
const tone = { draft: "default", published: "success", archived: "danger" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [projectResponse, skillResponse] = await Promise.all([api.get("/projects/me"), api.get("/user-skills/me")]);
      setProjects(projectResponse.data.data || []);
      setSkills((skillResponse.data.data || []).filter((item) => item.skill?.status === "active"));
    } catch (error) { toast.error(error.response?.data?.message || "Could not load portfolio projects"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.post("/projects", { ...form, outcomes: form.outcomes.split("\n").map((item) => item.trim()).filter(Boolean), startedAt: form.startedAt || null, completedAt: form.completedAt || null });
      setForm(emptyForm); setShowForm(false); await load(); toast.success("Project draft created");
    } catch (error) { toast.error(error.response?.data?.message || "Could not create project"); }
    finally { setBusy(false); }
  };
  const act = async (project, action) => {
    setBusy(true);
    try { await api.post(`/projects/${project._id}/${action}`); await load(); toast.success(action === "publish" ? "Project is now public" : "Project archived"); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update project"); }
    finally { setBusy(false); }
  };
  const toggleSkill = (id) => setForm((current) => ({ ...current, skillIds: current.skillIds.includes(id) ? current.skillIds.filter((value) => value !== id) : [...current.skillIds, id] }));

  if (loading) return <div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-28 rounded-3xl bg-surface-2" /><div className="h-56 rounded-2xl bg-surface-2" /></div>;
  return <div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><FolderKanban className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Portfolio Projects</h1></div><p className="mt-1 text-sm text-text-secondary">Publish concrete work samples to your professional SkillSwap profile.</p></div><Button onClick={() => setShowForm((value) => !value)} disabled={!skills.length}><Plus className="h-4 w-4" />Add project</Button></header>
    {!skills.length && <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">Add at least one canonical skill to your profile before creating a project.</div>}
    {showForm && <Card><CardHeader><h2 className="font-heading text-xl font-semibold text-text-primary">New project draft</h2></CardHeader><CardContent><form onSubmit={create} className="grid gap-4 sm:grid-cols-2"><Input label="Project title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} minLength={3} maxLength={160} required /><Input label="Your role" placeholder="Lead designer, backend engineer…" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} maxLength={120} /><Input label="Live project URL" type="url" value={form.projectUrl} onChange={(event) => setForm({ ...form, projectUrl: event.target.value })} /><Input label="Repository URL" type="url" value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /><Input label="Cover image URL" type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /><div className="grid grid-cols-2 gap-2"><Input label="Started" type="date" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} /><Input label="Completed" type="date" value={form.completedAt} onChange={(event) => setForm({ ...form, completedAt: event.target.value })} /></div><div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-text-secondary">Description</label><textarea aria-label="Project description" className="min-h-28 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-text-primary" minLength={10} maxLength={3000} required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="sm:col-span-2"><p className="mb-2 text-sm font-medium text-text-secondary">Skills demonstrated</p><div className="flex flex-wrap gap-2">{skills.map((item) => <button type="button" key={item.skill._id} onClick={() => toggleSkill(item.skill._id)} className={`rounded-xl border px-3 py-2 text-sm ${form.skillIds.includes(item.skill._id) ? "border-accent bg-accent/15 text-accent" : "border-border text-text-secondary hover:border-accent/50"}`}>{item.skill.name}</button>)}</div></div><div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-text-secondary">Outcomes <span className="font-normal">(one per line)</span></label><textarea aria-label="Project outcomes" className="min-h-20 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-text-primary" maxLength={2400} value={form.outcomes} onChange={(event) => setForm({ ...form, outcomes: event.target.value })} /></div><label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} className="h-4 w-4 accent-accent" />Feature this project first</label><div className="sm:text-right"><Button type="submit" disabled={busy || !form.skillIds.length}>Save draft</Button></div></form></CardContent></Card>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.length ? projects.map((project) => <Card key={project._id} className="overflow-hidden">{project.imageUrl && <img src={project.imageUrl} alt="Project cover" loading="lazy" decoding="async" className="h-40 w-full object-cover" />}<CardContent className="p-5"><div className="flex items-start justify-between gap-2"><Badge variant={tone[project.status]}>{project.status}</Badge>{project.featured && <span className="flex items-center gap-1 text-xs text-warning"><Star className="h-3.5 w-3.5 fill-current" />Featured</span>}</div><h2 className="mt-3 font-heading text-xl font-semibold text-text-primary">{project.title}</h2>{project.role && <p className="mt-1 text-xs text-accent">{project.role}</p>}<p className="mt-2 line-clamp-3 text-sm text-text-secondary">{project.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{project.skills.map((skill) => <Badge key={skill._id}>{skill.name}</Badge>)}</div><div className="mt-5 flex flex-wrap gap-2">{project.status === "draft" && <Button size="sm" disabled={busy} onClick={() => act(project, "publish")}><Rocket className="h-4 w-4" />Publish</Button>}<Button size="sm" variant="secondary" disabled={busy} onClick={() => act(project, "archive")}><Archive className="h-4 w-4" />Archive</Button>{project.projectUrl && <Button asChild size="sm" variant="ghost"><a href={project.projectUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Live</a></Button>}{project.repositoryUrl && <Button asChild size="sm" variant="ghost"><a href={project.repositoryUrl} target="_blank" rel="noreferrer"><Github className="h-4 w-4" />Code</a></Button>}</div></CardContent></Card>) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-text-secondary">No portfolio projects yet.</CardContent></Card>}</section>
  </div>;
}

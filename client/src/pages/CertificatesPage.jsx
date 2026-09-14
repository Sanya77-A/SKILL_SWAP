import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, BadgeCheck, CalendarDays, CheckCircle2, Copy, ExternalLink, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
const sourceNames = { challenge: "Challenge", roadmap: "Roadmap", roadmap_milestone: "Roadmap milestone", legacy: "Learning achievement" };

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [eligibility, setEligibility] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [certificateResponse, eligibilityResponse] = await Promise.all([api.get("/certificates/me"), api.get("/certificates/eligibility")]);
      setCertificates(certificateResponse.data.data || []);
      setEligibility(eligibilityResponse.data.data || []);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load certificates"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const issue = async (source) => {
    const key = `${source.sourceType}:${source.sourceId}:${source.milestoneId || ""}`;
    setBusy(key);
    try {
      await api.post("/certificates/issue", { sourceType: source.sourceType, sourceId: source.sourceId, ...(source.milestoneId && { milestoneId: source.milestoneId }) });
      await load(); toast.success("Verified certificate issued");
    } catch (error) { toast.error(error.response?.data?.message || "Could not issue certificate"); }
    finally { setBusy(""); }
  };
  const copyLink = async (certificateId) => {
    const url = `${window.location.origin}/verify/certificate/${certificateId}`;
    try { await navigator.clipboard.writeText(url); toast.success("Verification link copied"); }
    catch { toast.error("Could not copy the link"); }
  };

  if (loading) return <div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-32 rounded-3xl bg-surface-2" /><div className="grid gap-4 md:grid-cols-2"><div className="h-56 rounded-2xl bg-surface-2" /><div className="h-56 rounded-2xl bg-surface-2" /></div></div>;

  return <div className="mx-auto max-w-7xl space-y-7">
    <header className="rounded-3xl border border-warning/20 bg-gradient-to-br from-warning/10 via-surface to-accent/10 p-6 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-warning"><Award className="h-6 w-6" /><span className="text-sm font-semibold uppercase tracking-[0.18em]">Verifiable credentials</span></div><h1 className="mt-3 font-heading text-3xl font-bold text-text-primary sm:text-4xl">Certificates</h1><p className="mt-2 max-w-2xl text-text-secondary">Issue credentials only from completed SkillSwap evidence. Every certificate has a public status and integrity check.</p></div><div className="rounded-2xl border border-border bg-surface/80 px-5 py-3 text-center"><p className="text-3xl font-bold text-text-primary">{certificates.filter((item) => item.status === "active").length}</p><p className="text-xs text-text-secondary">Active credentials</p></div></div></header>

    <section><div className="mb-4"><h2 className="font-heading text-xl font-semibold text-text-primary">Eligible achievements</h2><p className="text-sm text-text-secondary">Completed challenges, roadmaps, and roadmap milestones become auditable certificate sources.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{eligibility.length ? eligibility.map((source) => { const key = `${source.sourceType}:${source.sourceId}:${source.milestoneId || ""}`; return <Card key={key}><CardContent className="p-5"><div className="flex items-start justify-between gap-2"><Badge variant="accent">{sourceNames[source.sourceType]}</Badge>{source.issued && <Badge variant={source.issued.status === "active" ? "success" : "danger"}>{source.issued.status === "active" ? "Issued" : "Revoked"}</Badge>}</div><h3 className="mt-3 font-heading text-lg font-semibold text-text-primary">{source.title}</h3>{source.context && <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{source.context}</p>}<p className="mt-3 flex items-center gap-2 text-sm text-text-secondary"><GraduationCap className="h-4 w-4 text-accent" />{source.skill?.name}</p><p className="mt-1 flex items-center gap-2 text-xs text-text-secondary"><CalendarDays className="h-4 w-4" />Completed {formatDate(source.completedAt)}</p><div className="mt-4">{source.issued ? <Button asChild variant="secondary" size="sm"><Link to={`/verify/certificate/${source.issued.certificateId}`}><ShieldCheck className="h-4 w-4" />Verify</Link></Button> : <Button size="sm" disabled={busy === key} onClick={() => issue(source)}><Sparkles className="h-4 w-4" />Issue certificate</Button>}</div></CardContent></Card>; }) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-text-secondary" /><p className="mt-2 text-sm text-text-secondary">Complete a challenge, roadmap, or milestone to become eligible.</p></CardContent></Card>}</div></section>

    <section><div className="mb-4"><h2 className="font-heading text-xl font-semibold text-text-primary">My credentials</h2><p className="text-sm text-text-secondary">Share the public verification link with anyone - no SkillSwap account is required.</p></div><div className="grid gap-4 md:grid-cols-2">{certificates.length ? certificates.map((certificate) => <Card key={certificate._id} className={certificate.status === "revoked" ? "opacity-75" : ""}><CardHeader className="border-b border-border bg-gradient-to-r from-warning/10 to-transparent"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-2xl bg-warning/15 p-3"><BadgeCheck className="h-7 w-7 text-warning" /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-warning">SkillSwap certificate</p><p className="mt-1 font-mono text-sm text-text-secondary">{certificate.certificateId}</p></div></div><Badge variant={certificate.status === "active" ? "success" : "danger"}>{certificate.status}</Badge></div></CardHeader><CardContent className="p-5"><h3 className="font-heading text-xl font-semibold text-text-primary">{certificate.achievement}</h3><p className="mt-1 text-accent">{certificate.skill?.name}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary"><span>Issued {formatDate(certificate.issuedAt)}</span><span>{sourceNames[certificate.sourceType] || "Verified achievement"}</span></div>{certificate.status === "revoked" && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Revoked{certificate.revocationReason ? `: ${certificate.revocationReason}` : ""}</p>}<div className="mt-5 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/verify/certificate/${certificate.certificateId}`}><ExternalLink className="h-4 w-4" />Public verification</Link></Button><Button size="sm" variant="secondary" onClick={() => copyLink(certificate.certificateId)}><Copy className="h-4 w-4" />Copy link</Button></div></CardContent></Card>) : <Card className="md:col-span-2"><CardContent className="py-12 text-center text-text-secondary">No certificates have been issued yet.</CardContent></Card>}</div></section>
  </div>;
}

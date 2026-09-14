import { useEffect, useState } from "react";
import { Award, CalendarDays, CheckCircle2, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(value));

export default function VerifyCertificatePage() {
  const { id } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get(`/certificates/verify/${encodeURIComponent(id)}`).then((response) => { if (active) setCertificate(response.data.data); }).catch((reason) => { if (active) setError(reason.response?.data?.message || "Certificate could not be verified"); });
    return () => { active = false; };
  }, [id]);

  if (!certificate && !error) return <div className="mx-auto max-w-3xl animate-pulse"><div className="h-[28rem] rounded-3xl bg-surface-2" /></div>;
  if (error) return <div className="mx-auto max-w-xl py-12"><Card><CardContent className="py-12 text-center"><ShieldAlert className="mx-auto h-12 w-12 text-danger" /><h1 className="mt-4 font-heading text-2xl font-bold text-text-primary">Certificate not verified</h1><p className="mt-2 text-text-secondary">{error}</p><Button asChild className="mt-5" variant="secondary"><Link to="/">Return to SkillSwap</Link></Button></CardContent></Card></div>;

  const valid = certificate.verified;
  return <div className="mx-auto max-w-3xl py-6 sm:py-12"><Card className="overflow-hidden"><div className={`h-2 ${valid ? "bg-accent-2" : "bg-danger"}`} /><CardContent className="p-6 sm:p-10"><div className="text-center"><span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${valid ? "bg-accent-2/15 text-accent-2" : "bg-danger/15 text-danger"}`}>{valid ? <ShieldCheck className="h-10 w-10" /> : <ShieldAlert className="h-10 w-10" />}</span><Badge className="mt-4" variant={valid ? "success" : "danger"}>{valid ? "Active and verified" : "Revoked"}</Badge><p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">SkillSwap certificate</p><h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">{certificate.achievement}</h1><p className="mt-2 text-lg text-accent">{certificate.skill?.name}</p></div><div className="my-8 h-px bg-border" /><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-surface-2 p-4"><UserRound className="h-5 w-5 text-accent" /><p className="mt-2 text-xs text-text-secondary">Awarded to</p><p className="font-semibold text-text-primary">{certificate.learner?.fullName || certificate.learner?.name}</p>{certificate.learner?.username && <p className="text-sm text-text-secondary">@{certificate.learner.username}</p>}</div><div className="rounded-2xl bg-surface-2 p-4"><CalendarDays className="h-5 w-5 text-accent" /><p className="mt-2 text-xs text-text-secondary">Issued</p><p className="font-semibold text-text-primary">{formatDate(certificate.issuedAt)}</p><p className="font-mono text-xs text-text-secondary">{certificate.certificateId}</p></div></div><div className="mt-5 rounded-2xl border border-border p-4"><div className="flex items-start gap-3"><Award className="mt-0.5 h-5 w-5 text-warning" /><div><p className="font-medium text-text-primary">Evidence provenance</p><p className="mt-1 text-sm text-text-secondary">Source: {certificate.sourceType.replaceAll("_", " ")}. Integrity record: {certificate.integrityValid === true ? "matches the issued credential" : certificate.integrityValid === null ? "legacy certificate" : "does not match"}.</p>{certificate.evidenceSnapshot?.completedAt && <p className="mt-1 text-xs text-text-secondary">Completed {formatDate(certificate.evidenceSnapshot.completedAt)}</p>}</div></div></div>{!valid && <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 p-4"><p className="font-medium text-danger">This credential is no longer valid.</p>{certificate.revocationReason && <p className="mt-1 text-sm text-text-secondary">{certificate.revocationReason}</p>}</div>}<div className="mt-8 flex items-center justify-center gap-2 text-sm text-text-secondary"><CheckCircle2 className="h-4 w-4" />Verified directly against SkillSwap records</div></CardContent></Card><div className="mt-5 text-center"><Button asChild variant="secondary"><Link to="/">Explore SkillSwap</Link></Button></div></div>;
}

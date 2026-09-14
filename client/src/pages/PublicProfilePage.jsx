import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Award, BadgeCheck, BookOpen, BriefcaseBusiness, CalendarCheck, Clock3, ExternalLink, FolderKanban, Github, GraduationCap,
  Languages, Linkedin, MapPin, Share2, ShieldAlert, ShieldCheck, Star, UsersRound,
} from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";

const resolveImage = (value) => value?.startsWith("http") ? value : value ? `/api${value}` : undefined;

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-4">
      <Icon className="mb-2 h-4 w-4 text-accent" aria-hidden="true" />
      <p className="text-xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

export default function PublicProfilePage() {
  const { profileHandle } = useParams();
  const handle = profileHandle?.replace(/^@/, "");
  const me = useSelector((state) => state.auth.user);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const sharePortfolio = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "SkillSwap portfolio", url });
      else { await navigator.clipboard.writeText(url); toast.success("Portfolio link copied"); }
    } catch (error) { if (error?.name !== "AbortError") toast.error("Could not share this portfolio"); }
  };

  useEffect(() => {
    setStatus("loading");
    api.get(`/users/by-username/${encodeURIComponent(handle)}`)
      .then((response) => {
        setResult(response.data.data);
        setStatus("ready");
      })
      .catch((error) => {
        setMessage(error.response?.data?.message || "Profile not found");
        setStatus(error.response?.status === 401 ? "members" : "missing");
      });
  }, [handle]);

  if (status === "loading") return <p className="py-16 text-center text-text-secondary" role="status">Loading profile…</p>;
  if (status !== "ready") {
    return (
      <Card className="mx-auto mt-16 max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">{message}</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {status === "members" ? "This member shares their profile with the SkillSwap community." : "The handle may be private or unavailable."}
        </p>
        {status === "members" && <Button asChild className="mt-6"><Link to="/login">Sign in to view</Link></Button>}
      </Card>
    );
  }

  const { user, skills = [], reviews = [], projects = [], certificates = [], stats = {}, isOwner } = result;
  const teaching = skills.filter((record) => record.teachingEnabled);
  const learning = skills.filter((record) => record.learningEnabled);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="overflow-hidden">
        <div
          className="h-40 bg-gradient-to-br from-accent/30 via-accent/10 to-accent-2/30 sm:h-56"
          style={user.coverImage ? { backgroundImage: `url(${resolveImage(user.coverImage)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <CardContent className="relative px-5 pb-6 pt-0 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="-mt-12 rounded-full border-4 border-surface bg-surface sm:-mt-16">
                <Avatar src={resolveImage(user.profilePhoto)} name={user.fullName} size="xl" />
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-3xl font-bold text-text-primary">{user.fullName}</h1>
                  {user.verificationBadges?.map((badge) => <Badge key={badge.key} variant="success">{badge.label}</Badge>)}
                  {stats.mentorStatus?.isMentor && <Badge variant={stats.mentorStatus.level === "verified" ? "success" : "accent"}>{stats.mentorStatus.level === "verified" ? "Verified mentor" : `${stats.mentorStatus.level} mentor`}</Badge>}
                </div>
                <p className="text-sm text-text-secondary">@{user.username}</p>
                {user.headline && <p className="mt-2 max-w-2xl text-text-primary">{user.headline}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                  {user.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{user.location}</span>}
                  {user.languages?.length > 0 && <span className="inline-flex items-center gap-1"><Languages className="h-4 w-4" />{user.languages.join(", ")}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={sharePortfolio}><Share2 className="h-4 w-4" />Share</Button>
              {me && !isOwner && me?._id !== user._id && <Button asChild variant="secondary"><Link to={`/safety?userId=${user._id}`}><ShieldAlert className="h-4 w-4" />Safety</Link></Button>}
              {isOwner || me?._id === user._id ? (
                <Button asChild><Link to="/profile">Edit profile</Link></Button>
              ) : me ? (
                <Button asChild><Link to={`/user/${user._id}`}>Connect and propose</Link></Button>
              ) : (
                <Button asChild><Link to="/register">Join to connect</Link></Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Award} label="SkillScore" value={`${stats.skillScore ?? 0}/100`} />
        <Stat icon={Star} label={`${stats.reviewCount ?? 0} reviews`} value={(stats.ratingAvg ?? 0).toFixed(1)} />
        <Stat icon={UsersRound} label="Sessions taught" value={stats.sessionsTaught ?? 0} />
        <Stat icon={BookOpen} label="Sessions learned" value={stats.sessionsLearned ?? 0} />
        <Stat icon={FolderKanban} label="Public projects" value={stats.projects ?? 0} />
        <Stat icon={BadgeCheck} label="Certificates" value={stats.certificates ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-heading text-xl font-semibold text-text-primary">About</h2></CardHeader>
            <CardContent className="space-y-4 text-sm text-text-secondary">
              <p className="whitespace-pre-wrap">{user.bio || "This member has not added a bio yet."}</p>
              {(user.occupation || user.company) && <p className="flex gap-2"><BriefcaseBusiness className="h-4 w-4 shrink-0 text-accent" />{[user.occupation, user.company].filter(Boolean).join(" at ")}</p>}
              {user.university && <p className="flex gap-2"><GraduationCap className="h-4 w-4 shrink-0 text-accent" />{user.university}</p>}
              {user.availability?.length > 0 && <p><strong className="text-text-primary">Availability:</strong> {user.availability.join(", ")}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-heading text-xl font-semibold text-text-primary">Skills</h2></CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              {[{ title: "Can teach", values: teaching }, { title: "Learning", values: learning }].map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 text-sm font-semibold text-text-primary">{section.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {section.values.length ? section.values.map((record) => (
                      <Badge key={record._id} variant={record.verificationStatus === "verified" ? "success" : "default"}>
                        {record.skill?.name} · {record.proficiency}
                      </Badge>
                    )) : <p className="text-sm text-text-secondary">Nothing listed yet.</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center justify-between"><h2 className="font-heading text-xl font-semibold text-text-primary">Projects</h2>{isOwner && <Button asChild size="sm" variant="secondary"><Link to="/projects">Manage</Link></Button>}</div></CardHeader>
            <CardContent>{projects.length ? <div className="grid gap-4 sm:grid-cols-2">{projects.map((project) => <article key={project._id} className="overflow-hidden rounded-2xl border border-border bg-surface-2">{project.imageUrl && <img src={project.imageUrl} alt="Project cover" loading="lazy" decoding="async" className="h-32 w-full object-cover" />}<div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-heading text-lg font-semibold text-text-primary">{project.title}</h3>{project.featured && <Star className="h-4 w-4 shrink-0 fill-warning text-warning" />}</div>{project.role && <p className="mt-1 text-xs font-medium text-accent">{project.role}</p>}<p className="mt-2 line-clamp-3 text-sm text-text-secondary">{project.description}</p><div className="mt-3 flex flex-wrap gap-1">{project.skills.map((skill) => <Badge key={skill._id}>{skill.name}</Badge>)}</div>{project.outcomes?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-text-secondary">{project.outcomes.slice(0, 3).map((outcome) => <li key={outcome}>• {outcome}</li>)}</ul>}<div className="mt-4 flex gap-3 text-sm">{project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">View project <ExternalLink className="h-3.5 w-3.5" /></a>}{project.repositoryUrl && <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Github className="h-3.5 w-3.5" />Code</a>}</div></div></article>)}</div> : <p className="text-sm text-text-secondary">No public projects yet.</p>}</CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-heading text-xl font-semibold text-text-primary">Reviews</h2></CardHeader>
            <CardContent>
              {reviews.length ? <ul className="divide-y divide-border">{reviews.map((review) => (
                <li key={review._id} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-medium text-text-primary">{review.reviewer?.fullName || review.reviewer?.name || review.author?.fullName || review.author?.name} · {review.ratings?.overall || review.rating}/5</p>
                  {review.ratings && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(review.ratings).filter(([key]) => key !== "overall").map(([key, value]) => <Badge key={key} variant="default">{key} {value}/5</Badge>)}</div>}
                  {review.comment && <p className="mt-1 text-sm text-text-secondary">{review.comment}</p>}
                  {review.wouldLearnAgain && <p className="mt-1 text-xs text-accent-2">Would learn together again</p>}
                  {me && String(review.reviewer?._id || review.author?._id) !== String(me._id) && <Link to={`/safety?targetType=review&targetId=${review._id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-danger"><ShieldAlert className="h-3.5 w-3.5" />Report review</Link>}
                </li>
              ))}</ul> : <p className="text-sm text-text-secondary">No reviews yet. Completed sessions unlock verified reviews.</p>}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Portfolio & links</h2></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Website", user.website, ExternalLink], ["GitHub", user.github, Github], ["LinkedIn", user.linkedin, Linkedin],
                ...(user.portfolioLinks || []).map((link) => [link.label || "Portfolio", link.url, ExternalLink]),
              ].filter(([, url]) => url).map(([label, url, Icon]) => (
                <a key={`${label}-${url}`} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-accent hover:underline"><Icon className="h-4 w-4" />{label}</a>
              ))}
              {!user.website && !user.github && !user.linkedin && !user.portfolioLinks?.length && <p className="text-text-secondary">No portfolio links yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Recognition</h2></CardHeader>
            <CardContent className="space-y-3">
              {user.achievements?.length ? user.achievements.map((achievement) => (
                <div key={achievement.key} className="flex gap-2 text-sm"><Award className="h-4 w-4 shrink-0 text-accent" /><div><p className="font-medium text-text-primary">{achievement.title}</p><p className="text-text-secondary">{achievement.description}</p></div></div>
              )) : <p className="text-sm text-text-secondary">Achievements appear as this member teaches, learns, and contributes.</p>}
              {stats.verifiedSkills > 0 && <p className="flex items-center gap-2 text-sm text-text-secondary"><ShieldCheck className="h-4 w-4 text-accent-2" />{stats.verifiedSkills} verified skill{stats.verifiedSkills === 1 ? "" : "s"}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Certificates</h2></CardHeader>
            <CardContent className="space-y-3">{certificates.length ? certificates.map((certificate) => <Link key={certificate._id} to={`/verify/certificate/${certificate.certificateId}`} className="block rounded-xl border border-warning/25 bg-warning/5 p-3 hover:border-warning"><div className="flex gap-2"><BadgeCheck className="h-5 w-5 shrink-0 text-warning" /><div><p className="text-sm font-medium text-text-primary">{certificate.achievement}</p><p className="mt-0.5 text-xs text-text-secondary">{certificate.skill?.name} · {certificate.certificateId}</p></div></div></Link>) : <p className="text-sm text-text-secondary">No active certificates.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="font-heading text-lg font-semibold text-text-primary">Mentor activity</h2></CardHeader>
            <CardContent className="space-y-2 text-sm text-text-secondary"><p><strong className="text-text-primary">Status:</strong> {stats.mentorStatus?.level?.replace("_", " ") || "not a mentor"}</p><p><strong className="text-text-primary">Teaching skills:</strong> {stats.mentorStatus?.teachingSkills || 0}</p><p><strong className="text-text-primary">Published listings:</strong> {stats.mentorStatus?.publishedListings || 0}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-accent" />Typical response: {stats.responseTimeMinutes ? `${stats.responseTimeMinutes} min` : "New mentor"}</p></CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, Bookmark, CalendarPlus, CheckCircle2, Heart, MessageCircle, MessagesSquare, Rocket, Send, Sparkles, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const typeView = {
  certificate_earned: { label: "Certificate", icon: Award, tone: "text-warning bg-warning/10" },
  challenge_completed: { label: "Challenge", icon: Trophy, tone: "text-accent-2 bg-accent-2/10" },
  listing_published: { label: "New listing", icon: Rocket, tone: "text-accent bg-accent/10" },
  skill_milestone: { label: "Milestone", icon: CheckCircle2, tone: "text-accent-2 bg-accent-2/10" },
  community_post: { label: "Community", icon: MessagesSquare, tone: "text-accent bg-accent/10" },
  mentor_achievement: { label: "Mentor", icon: Sparkles, tone: "text-warning bg-warning/10" },
  group_session_announced: { label: "Group session", icon: CalendarPlus, tone: "text-accent bg-accent/10" },
};
const relativeTime = (value) => {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value)) / 1000));
  if (seconds < 60) return "just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`;
};

function ActivityCard({ activity, onUpdate }) {
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const view = typeView[activity.type] || typeView.mentor_achievement;
  const Icon = view.icon;
  const toggle = async (kind) => {
    setBusy(true);
    const enabled = kind === "like" ? activity.liked : activity.saved;
    try {
      const response = await api({ method: enabled ? "delete" : "post", url: `/feed/${activity._id}/${kind}` });
      onUpdate({ ...response.data.data, liked: kind === "like" ? !enabled : activity.liked, saved: kind === "save" ? !enabled : activity.saved });
    } catch (error) { toast.error(error.response?.data?.message || `Could not ${kind} activity`); }
    finally { setBusy(false); }
  };
  const loadComments = async () => {
    if (comments) { setComments(null); return; }
    try { setComments((await api.get(`/feed/${activity._id}/comments`, { params: { limit: 50 } })).data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Could not load comments"); }
  };
  const submitComment = async (event) => {
    event.preventDefault(); if (!body.trim()) return; setBusy(true);
    try { const response = await api.post(`/feed/${activity._id}/comments`, { body }); setComments((current) => [...(current || []), response.data.data]); setBody(""); onUpdate({ ...activity, commentCount: activity.commentCount + 1 }); }
    catch (error) { toast.error(error.response?.data?.message || "Could not add comment"); }
    finally { setBusy(false); }
  };
  return <Card><CardContent className="p-5 sm:p-6"><div className="flex items-start gap-3"><Link to={activity.actor?.username ? `/@${activity.actor.username}` : `/user/${activity.actor?._id}`}><Avatar src={activity.actor?.profilePhoto} name={activity.actor?.fullName || activity.actor?.name} size="md" /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Link to={activity.actor?.username ? `/@${activity.actor.username}` : `/user/${activity.actor?._id}`} className="font-semibold text-text-primary hover:text-accent">{activity.actor?.fullName || activity.actor?.name}</Link><span className="text-xs text-text-secondary">{relativeTime(activity.occurredAt)}</span></div>{activity.actor?.headline && <p className="truncate text-xs text-text-secondary">{activity.actor.headline}</p>}</div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${view.tone}`}><Icon className="h-5 w-5" /></span></div><div className="mt-4"><Badge variant="accent">{view.label}</Badge><h2 className="mt-2 font-heading text-xl font-semibold text-text-primary">{activity.title}</h2>{activity.body && <p className="mt-1 text-sm text-text-secondary">{activity.body}</p>}{activity.skill && <p className="mt-2 text-xs font-medium text-accent">{activity.skill.name} · {activity.skill.category}</p>}<Button asChild size="sm" variant="secondary" className="mt-4"><Link to={activity.link}>View evidence</Link></Button></div><div className="mt-5 flex items-center gap-1 border-t border-border pt-3"><Button variant="ghost" size="sm" disabled={busy} className={activity.liked ? "text-danger" : ""} onClick={() => toggle("like")}><Heart className={`h-4 w-4 ${activity.liked ? "fill-current" : ""}`} />{activity.likeCount}</Button><Button variant="ghost" size="sm" onClick={loadComments}><MessageCircle className="h-4 w-4" />{activity.commentCount}</Button><Button variant="ghost" size="sm" disabled={busy} className={activity.saved ? "text-accent" : ""} onClick={() => toggle("save")}><Bookmark className={`h-4 w-4 ${activity.saved ? "fill-current" : ""}`} />{activity.saved ? "Saved" : "Save"}</Button></div>{comments && <div className="mt-3 space-y-3 rounded-2xl bg-surface-2 p-3"><form onSubmit={submitComment} className="flex gap-2"><input aria-label="Add a comment" className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary" maxLength={1500} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a useful comment…" /><Button type="submit" size="sm" disabled={busy || !body.trim()} aria-label="Post comment"><Send className="h-4 w-4" /></Button></form>{comments.length ? comments.map((comment) => <div key={comment._id} className="flex gap-2"><Avatar src={comment.author?.profilePhoto} name={comment.author?.fullName || comment.author?.name} size="sm" /><div><p className="text-xs font-semibold text-text-primary">{comment.author?.fullName || comment.author?.name}</p><p className="text-sm text-text-secondary">{comment.body}</p></div></div>) : <p className="py-2 text-center text-xs text-text-secondary">No comments yet.</p>}</div>}</CardContent></Card>;
}

export default function ActivityFeedPage() {
  const [items, setItems] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    api.get("/feed", { params: { limit: 50, ...(saved && { saved: true }) } }).then((response) => { if (active) setItems(response.data.data || []); }).catch((error) => toast.error(error.response?.data?.message || "Could not load activity")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [saved]);
  const update = (next) => setItems((current) => current.map((item) => item._id === next._id ? next : item).filter((item) => !saved || item.saved));
  return <div className="mx-auto max-w-3xl space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">Activity Feed</h1></div><p className="mt-1 text-sm text-text-secondary">A secondary view of verified learning and marketplace progress - not a general social timeline.</p></div><div className="flex gap-2"><Button variant={!saved ? "primary" : "secondary"} onClick={() => setSaved(false)}>Recent</Button><Button variant={saved ? "primary" : "secondary"} onClick={() => setSaved(true)}><Bookmark className="h-4 w-4" />Saved</Button></div></header>{loading ? <div className="animate-pulse space-y-4"><div className="h-60 rounded-2xl bg-surface-2" /><div className="h-60 rounded-2xl bg-surface-2" /></div> : items.length ? items.map((item) => <ActivityCard key={item._id} activity={item} onUpdate={update} />) : <Card><CardContent className="py-14 text-center"><Sparkles className="mx-auto h-9 w-9 text-text-secondary" /><p className="mt-2 text-sm text-text-secondary">{saved ? "You have not saved any activity yet." : "Meaningful marketplace activity will appear here."}</p></CardContent></Card>}</div>;
}

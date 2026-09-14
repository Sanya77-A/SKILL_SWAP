import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import { api } from "../../utils/api";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Card, CardContent } from "../ui/Card";

export function SmartMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/matches", { params: { limit: 4 } })
      .then((response) => setMatches(response.data.data || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-text-secondary" role="status">Calculating compatible peers…</p>;
  if (!matches.length) return null;
  return <section><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /><h2 className="font-heading text-xl font-semibold text-text-primary">Smart matches</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{matches.map((match) => <Link key={match.user._id} to={`/@${match.user.username}`} className="block h-full"><Card hover className="h-full"><CardContent><div className="flex items-center gap-3"><Avatar src={match.user.profilePhoto} name={match.user.fullName} size="lg" /><div><p className="font-medium text-text-primary">{match.user.fullName}</p><p className="text-xs text-text-secondary">@{match.user.username}</p></div></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-text-secondary">Compatibility</span><strong className="text-accent">{match.matchScore}%</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${match.matchScore}%` }} /></div><div className="mt-4 flex flex-wrap gap-1">{match.strengths.slice(0, 3).map((reason) => <Badge key={reason} variant="success">{reason}</Badge>)}</div>{match.conflicts.length > 0 && <p className="mt-3 flex gap-1 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{match.conflicts[0]}</p>}</CardContent></Card></Link>)}</div></section>;
}

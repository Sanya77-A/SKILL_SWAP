import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Languages, MapPin, Star } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { InlineNotice } from "../components/ui/InlineNotice";
import { Skeleton } from "../components/ui/Skeleton";

export default function DemoMentorPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/demo/mentors/${id}`).then((response) => setData(response.data.data)).catch((requestError) => setError(requestError.response?.data?.message || "Demo mentor could not be loaded."));
  }, [id]);

  if (error) return <Card className="p-8 text-danger" role="alert">{error}</Card>;
  if (!data) return <Skeleton className="h-80 rounded-2xl" />;
  const { mentor, listings } = data;

  return <div className="mx-auto max-w-5xl space-y-6">
    <Button asChild variant="ghost"><Link to="/discover"><ArrowLeft className="h-4 w-4" />Back to demo explore</Link></Button>
    <InlineNotice title="Fictional mentor profile">{data.notice} Contact, booking, and payment actions are intentionally unavailable.</InlineNotice>
    <Card className="p-7 sm:p-9">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar src={mentor.profilePhoto} name={mentor.fullName} size="lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="font-heading text-3xl font-bold text-text-primary">{mentor.fullName}</h1><Badge variant="warning">Demo mentor</Badge></div><p className="mt-2 text-text-secondary">{mentor.headline}</p><div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary"><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{mentor.location}</span><span className="inline-flex items-center gap-1"><Languages className="h-4 w-4" />{mentor.languages.join(", ")}</span><span className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-warning" />{mentor.ratingAvg} from {mentor.ratingCount} fictional reviews</span></div></div>
      </div>
      <p className="mt-7 max-w-3xl leading-7 text-text-secondary">{mentor.bio}</p>
      <div className="mt-6 flex flex-wrap gap-2">{mentor.skillsOffered.map((skill) => <Badge key={skill} variant="accent">{skill}</Badge>)}</div>
      <div className="mt-6 space-y-2">{mentor.verificationBadges.map((badge) => <p key={badge} className="flex items-center gap-2 text-sm text-text-secondary"><BadgeCheck className="h-4 w-4 text-accent" />{badge} (fictional demo evidence)</p>)}</div>
    </Card>
    <section><h2 className="mb-4 font-heading text-2xl font-semibold text-text-primary">Sample listings</h2><div className="grid gap-4 md:grid-cols-2">{listings.map((listing) => <Card key={listing._id} className="p-6"><Badge variant="accent">{listing.skill.name}</Badge><h3 className="mt-3 font-heading text-lg font-semibold text-text-primary">{listing.title}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{listing.description}</p><p className="mt-4 text-xs text-text-secondary">Read-only · {listing.creditCost} sample credits</p></Card>)}</div></section>
  </div>;
}

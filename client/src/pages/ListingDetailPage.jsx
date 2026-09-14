import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Flag } from "lucide-react";
import { api } from "../utils/api";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { ProposalComposer } from "../components/proposals/ProposalComposer";
import { useSelector } from "react-redux";

export default function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [missing, setMissing] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const me = useSelector((state) => state.auth.user);
  useEffect(() => { api.get(`/listings/${id}`).then((response) => setListing(response.data.data)).catch(() => setMissing(true)); }, [id]);
  if (missing) return <Card className="mx-auto mt-16 max-w-lg p-10 text-center text-text-secondary">This listing is unavailable or no longer published.</Card>;
  if (!listing) return <p className="py-16 text-center text-text-secondary" role="status">Loading listing…</p>;
  return <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
    <div className="space-y-6"><Card><CardContent><Badge variant="accent">{listing.skill?.name}</Badge><h1 className="mt-4 font-heading text-3xl font-bold text-text-primary">{listing.title}</h1><p className="mt-4 whitespace-pre-wrap text-text-secondary">{listing.description}</p></CardContent></Card><Card><CardHeader><h2 className="font-heading text-xl font-semibold text-text-primary">What you will learn</h2></CardHeader><CardContent><ul className="space-y-3">{listing.learningOutcomes.map((outcome) => <li key={outcome} className="flex gap-2 text-text-secondary"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" />{outcome}</li>)}</ul>{listing.prerequisites.length > 0 && <><h3 className="mb-2 mt-6 font-medium text-text-primary">Prerequisites</h3><ul className="list-inside list-disc text-sm text-text-secondary">{listing.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></>}</CardContent></Card></div>
    <aside><Card className="sticky top-6"><CardContent><div className="flex items-center gap-3"><Avatar src={listing.owner?.profilePhoto} name={listing.owner?.fullName || listing.owner?.name} size="lg" /><div><p className="font-medium text-text-primary">{listing.owner?.fullName || listing.owner?.name}</p><p className="text-xs text-text-secondary">★ {listing.owner?.ratingAvg || "New"}</p></div></div><div className="my-5 space-y-2 text-sm text-text-secondary"><p>{listing.sessionDurations.join(" / ")} minutes</p><p>{listing.deliveryMode.join(", ").replaceAll("_", " ")}</p>{listing.exchangeEnabled && <p>Skill exchange available</p>}{listing.creditsEnabled && <p>{listing.creditCost} SkillCredits</p>}{listing.paidEnabled && <p>{listing.currency} {listing.price}</p>}</div>{me && me._id !== listing.owner?._id && <Button className="mb-2 w-full" onClick={() => setProposalOpen(true)}>Make a proposal</Button>}<Button asChild variant="secondary" className="w-full"><Link to={`/@${listing.owner?.username}`}>View mentor profile</Link></Button>{me && me._id !== listing.owner?._id && <Button asChild variant="ghost" className="mt-2 w-full"><Link to={`/safety?targetType=listing&targetId=${listing._id}`}><Flag className="h-4 w-4" />Report listing</Link></Button>}</CardContent></Card></aside>
    <Modal open={proposalOpen} onClose={() => setProposalOpen(false)} title="Make a skill proposal" size="lg"><ProposalComposer listing={listing} onComplete={() => setProposalOpen(false)} /></Modal>
  </div>;
}

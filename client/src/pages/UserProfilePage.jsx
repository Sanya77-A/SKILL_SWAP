import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { getUserById } from "../features/user/userSlice";
import { createRequest } from "../features/requests/requestsSlice";
import { getOrCreateConversation } from "../features/chat/chatSlice";
import { createReport } from "../features/reports/reportSlice";
import { api } from "../utils/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";

export default function UserProfilePage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { user: me } = useSelector((s) => s.auth);
  const profile = useSelector((s) => s.user.selectedUser);
  const [skillToTeach, setSkillToTeach] = useState("");
  const [skillToLearn, setSkillToLearn] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (id) {
      dispatch(getUserById(id));
      api.get(`/users/${id}/reviews`).then((r) => setReviews(r.data.data || [])).catch(() => setReviews([]));
    }
  }, [id, dispatch]);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    const result = await dispatch(createRequest({ receiverId: id, skillToTeach, skillToLearn, message }));
    if (createRequest.fulfilled.match(result)) {
      toast.success("Request sent");
      setSent(true);
    } else {
      toast.error(result.payload || "Failed");
    }
  };

  const handleChat = async () => {
    const result = await dispatch(getOrCreateConversation(id));
    if (getOrCreateConversation.fulfilled.match(result)) {
      window.location.href = "/chat";
    } else {
      toast.error(result.payload || "Accept a swap with this user first to chat.");
    }
  };

  const handleReport = (e) => {
    e.preventDefault();
    dispatch(createReport({ reportedUserId: id, reason: reportReason || "No reason provided" }))
      .then((r) => {
        if (createReport.fulfilled.match(r)) {
          toast.success("Report submitted");
          setReportOpen(false);
          setReportReason("");
        } else toast.error(r.payload || "Failed");
      });
  };

  if (!profile) return <p className="text-text-secondary">Loading...</p>;
  if (profile._id === me?._id) return <p className="text-text-secondary">That's you. <Link to="/profile" className="text-accent hover:underline">Edit profile</Link></p>;

  const profileImg = profile.profileImage?.startsWith("http") ? profile.profileImage : profile.profileImage ? `/api${profile.profileImage}` : undefined;

  return (
    <div className="max-w-2xl">
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-4">
          <Avatar src={profileImg} name={profile.name} size="lg" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-text-primary">{profile.name}</h1>
            <p className="text-text-secondary text-sm">Rating: {profile.ratingAvg ?? 0} ({profile.ratingCount ?? 0} reviews)</p>
            <p className="mt-2 text-text-primary"><strong>Offers:</strong> {profile.skillsOffered?.join(", ") || "Not listed"}</p>
            <p className="text-text-primary"><strong>Wants:</strong> {profile.skillsWanted?.join(", ") || "Not listed"}</p>
            <p className="text-text-secondary text-sm">Level: {profile.experienceLevel} · {profile.availability?.join(", ") || "Not listed"}</p>
            {profile.bio && <p className="mt-2 text-text-secondary">{profile.bio}</p>}
            <div className="mt-4 flex gap-2">
              <Button onClick={handleChat}>Chat</Button>
              <Button variant="secondary" type="button" onClick={() => setReportOpen(true)}>Report user</Button>
            </div>
          </div>
        </div>
      </Card>
      <Modal open={reportOpen} onClose={() => { setReportOpen(false); setReportReason(""); }} title={`Report ${profile.name}`}>
        <form onSubmit={handleReport} className="space-y-4">
          <Textarea
            label="Reason for report (optional)"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason for report (optional)"
            rows={3}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger">Submit report</Button>
            <Button type="button" variant="secondary" onClick={() => { setReportOpen(false); setReportReason(""); }}>Cancel</Button>
          </div>
        </form>
      </Modal>
      {!sent ? (
        <Card className="p-6 mb-8">
          <form onSubmit={handleSendRequest} className="space-y-4">
            <h2 className="font-heading font-semibold text-text-primary">Send swap request</h2>
            <Input label="Skill you'll teach" value={skillToTeach} onChange={(e) => setSkillToTeach(e.target.value)} required />
            <Input label="Skill you want to learn" value={skillToLearn} onChange={(e) => setSkillToLearn(e.target.value)} required />
            <Textarea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            <Button type="submit">Send request</Button>
          </form>
        </Card>
      ) : (
        <p className="text-accent-2 mb-8">Request sent.</p>
      )}
      <div className="mt-8">
        <h2 className="font-heading font-semibold text-lg text-text-primary mb-4">Reviews</h2>
        {reviews.length === 0 ? <p className="text-text-secondary">No reviews yet.</p> : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r._id}>
                <Card className="p-4">
                  <p className="font-medium text-text-primary">{r.reviewer?.fullName || r.reviewer?.name || r.author?.name} · {r.ratings?.overall || r.rating}/5</p>
                  {r.ratings && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(r.ratings).filter(([key]) => key !== "overall").map(([key, value]) => <Badge key={key} variant="default">{key} {value}/5</Badge>)}</div>}
                  {r.comment && <p className="text-sm text-text-secondary mt-1">{r.comment}</p>}
                  {r.wouldLearnAgain && <p className="mt-1 text-xs text-accent-2">Would learn together again</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

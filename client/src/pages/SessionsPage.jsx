import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchSessions, createSession, acceptSession, completeSession } from "../features/sessions/sessionSlice";
import { fetchRequests } from "../features/requests/requestsSlice";
import { api } from "../utils/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function SessionsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { data: sessions, loading, error } = useSelector((s) => s.sessions);
  const { data: requests } = useSelector((s) => s.requests);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [slots, setSlots] = useState("");
  const [acceptingId, setAcceptingId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  useEffect(() => {
    dispatch(fetchSessions({ page: 1, limit: 50 }));
    dispatch(fetchRequests({ status: "ACCEPTED" }));
  }, [dispatch]);

  useEffect(() => {
    if (!requests?.length) return;
    api.get("/sessions", { params: { limit: 200 } })
      .then((r) => {
        const existingRequestIds = (r.data.data || []).map((s) => s.requestId?._id || s.requestId);
        setAcceptedRequests(requests.filter((req) => !existingRequestIds.includes(req._id)));
      })
      .catch(() => setAcceptedRequests(requests));
  }, [requests]);

  const handleCreate = (e) => {
    e.preventDefault();
    const proposedSlots = slots.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!requestId || proposedSlots.length === 0) {
      toast.error("Select a request and add at least one time slot");
      return;
    }
    dispatch(createSession({ requestId, proposedSlots }))
      .then((r) => {
        if (createSession.fulfilled.match(r)) {
          toast.success("Session proposed");
          setCreateOpen(false);
          setRequestId("");
          setSlots("");
          dispatch(fetchSessions({ page: 1 }));
        } else toast.error(r.payload || "Failed");
      });
  };

  const handleAccept = (session) => {
    if (!selectedSlot || !session.proposedSlots?.includes(selectedSlot)) {
      toast.error("Select a slot");
      return;
    }
    dispatch(acceptSession({ sessionId: session._id, acceptedSlot: selectedSlot }))
      .then((r) => {
        if (acceptSession.fulfilled.match(r)) {
          toast.success("Session confirmed");
          setAcceptingId("");
          setSelectedSlot("");
          dispatch(fetchSessions({ page: 1 }));
        } else toast.error(r.payload || "Failed");
      });
  };

  const handleComplete = (session) => {
    dispatch(completeSession(session._id))
      .then((r) => {
        if (completeSession.fulfilled.match(r)) {
          toast.success("Session completed");
          dispatch(fetchSessions({ page: 1 }));
        } else toast.error(r.payload || "Failed");
      });
  };

  const isTeacher = (s) => s.teacherId?._id === user?._id || s.teacherId === user?._id;
  const isStudent = (s) => s.studentId?._id === user?._id || s.studentId === user?._id;
  const otherParty = (s) => {
    if (isTeacher(s)) return s.studentId;
    return s.teacherId;
  };

  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">Sessions</h1>
      <p className="text-text-secondary text-sm mb-6">Propose and manage swap sessions.</p>
      <div className="mb-6 flex gap-2">
        <Button onClick={() => setCreateOpen(true)}>Propose session</Button>
      </div>

      {createOpen && (
        <Card className="mb-8 p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="font-heading font-semibold text-text-primary">Propose time slots (accepted requests only)</h2>
            <div>
              <label htmlFor="legacy-session-request" className="block text-sm font-medium text-text-secondary mb-1.5">Request</label>
              <select
                id="legacy-session-request"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent"
              >
                <option value="">Select request</option>
                {acceptedRequests.map((req) => (
                  <option key={req._id} value={req._id}>
                    {req.sender?.name} ↔ {req.receiver?.name} - {req.skillToTeach} / {req.skillToLearn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="legacy-session-slots" className="block text-sm font-medium text-text-secondary mb-1.5">Proposed slots (one per line or comma-separated)</label>
              <textarea
                id="legacy-session-slots"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                placeholder="e.g. Mon 10am, Tue 2pm"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder:text-text-secondary focus:ring-2 focus:ring-accent"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading && <p className="text-text-secondary">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}
      <div className="space-y-4">
        {(sessions || []).map((s) => (
          <Card key={s._id} className="p-6">
            <p className="font-medium text-text-primary">
              With: {typeof otherParty(s) === "object" ? otherParty(s)?.name : " - "}
              {s.requestId && (
                <span className="text-sm text-text-secondary ml-2">
                  ({s.requestId.skillToTeach} / {s.requestId.skillToLearn})
                </span>
              )}
            </p>
            <p className="text-sm text-text-secondary capitalize mt-1">Status: {s.status?.toLowerCase()}</p>
            {s.proposedSlots?.length > 0 && <p className="text-sm text-text-secondary mt-1">Proposed: {s.proposedSlots.join(", ")}</p>}
            {s.acceptedSlot && <p className="text-sm text-accent-2 mt-1">Confirmed slot: {s.acceptedSlot}</p>}
            {s.status === "PROPOSED" && isStudent(s) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Choose a proposed session slot"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  onFocus={() => setAcceptingId(s._id)}
                  className="px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:ring-2 focus:ring-accent"
                >
                  <option value="">Choose slot</option>
                  {(s.proposedSlots || []).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                <Button size="sm" variant="success" onClick={() => handleAccept(s)} disabled={acceptingId === s._id && !selectedSlot}>Accept</Button>
              </div>
            )}
            {s.status === "CONFIRMED" && (
              <Button size="sm" className="mt-4" onClick={() => handleComplete(s)}>Mark complete</Button>
            )}
          </Card>
        ))}
      </div>
      {(!sessions || sessions.length === 0) && !loading && <Card className="p-12 text-center text-text-secondary">No sessions yet. Accept a swap request, then propose a session.</Card>}
    </div>
  );
}

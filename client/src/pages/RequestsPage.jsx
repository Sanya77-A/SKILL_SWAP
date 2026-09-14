import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { fetchRequests, updateRequest } from "../features/requests/requestsSlice";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";

export default function RequestsPage() {
  const dispatch = useDispatch();
  const [type, setType] = useState("incoming");
  const { data: requests } = useSelector((s) => s.requests);
  const { user } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchRequests({ type, limit: 50 }));
  }, [type, dispatch]);

  const handleAction = async (id, action) => {
    const result = await dispatch(updateRequest({ id, action }));
    if (updateRequest.fulfilled.match(result)) {
      toast.success(`Request ${action}ed`);
      dispatch(fetchRequests({ type, limit: 50 }));
    } else toast.error(result.payload || "Failed");
  };

  const handleComplete = async (id) => {
    const result = await dispatch(updateRequest({ id, action: "complete" }));
    if (updateRequest.fulfilled.match(result)) toast.success("Marked complete");
    dispatch(fetchRequests({ type, limit: 50 }));
  };

  const badgeVariant = (status) => (status === "PENDING" ? "warning" : status === "ACCEPTED" ? "success" : status === "COMPLETED" ? "accent" : "default");

  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">Swap requests</h1>
      <p className="text-text-secondary text-sm mb-6">Manage incoming and outgoing swap requests.</p>
      <Tabs value={type} onChange={setType}>
        <TabsList className="mb-6">
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
        </TabsList>
        <div className="space-y-4">
          {(requests || []).map((r) => {
            const isReceiver = r.receiver?._id?.toString() === user?._id?.toString();
            const other = isReceiver ? r.sender : r.receiver;
            return (
              <Card key={r._id} className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar src={other?.profileImage} name={other?.name} size="md" />
                  <div>
                    <p className="font-medium text-text-primary">{other?.name}</p>
                    <p className="text-sm text-text-secondary">Teach: {r.skillToTeach} · Learn: {r.skillToLearn}</p>
                    {r.message && <p className="text-sm text-text-secondary mt-1">{r.message}</p>}
                    <Badge variant={badgeVariant(r.status)} className="mt-2">{r.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isReceiver && r.status === "PENDING" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => handleAction(r._id, "accept")}>Accept</Button>
                      <Button size="sm" variant="danger" onClick={() => handleAction(r._id, "reject")}>Reject</Button>
                    </>
                  )}
                  {r.status === "ACCEPTED" && (
                    <Button size="sm" onClick={() => handleComplete(r._id)}>Mark complete</Button>
                  )}
                  {r.status === "COMPLETED" && (
                    <Button size="sm" variant="secondary" asChild><Link to={`/user/${other?._id}`}>Leave review</Link></Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        {(!requests || requests.length === 0) && <Card className="p-12 text-center text-text-secondary">No requests.</Card>}
      </Tabs>
    </div>
  );
}

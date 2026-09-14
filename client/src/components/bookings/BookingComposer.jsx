import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../utils/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

export function BookingComposer({ proposal, onComplete }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [form, setForm] = useState({ leg: "requested", sequence: 1, startAt: "", duration: proposal.duration, mode: proposal.deliveryMode, timezone, locationDetails: "" });
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/bookings", { ...form, proposalId: proposal._id, sequence: Number(form.sequence), duration: Number(form.duration), startAt: new Date(form.startAt).toISOString() });
      toast.success("Booking requested"); onComplete?.();
    } catch (error) { toast.error(error.response?.data?.message || "Could not request booking"); }
    finally { setSaving(false); }
  };
  const maxSequence = form.leg === "requested" ? proposal.requestedSessions : proposal.offeredSessions;
  return <form onSubmit={submit} className="space-y-4"><Select label="Session direction" value={form.leg} onChange={update("leg")} options={[{ value: "requested", label: `${proposal.recipient.fullName || proposal.recipient.name} teaches ${proposal.requestedSkill.name}` }, { value: "offered", label: `${proposal.requester.fullName || proposal.requester.name} teaches ${proposal.offeredSkill.name}` }]} /><Input label={`Session number (1-${maxSequence})`} type="number" min="1" max={maxSequence} value={form.sequence} onChange={update("sequence")} /><Input label="Start time" type="datetime-local" required value={form.startAt} onChange={update("startAt")} /><div className="grid grid-cols-2 gap-3"><Input label="Duration" type="number" min="15" step="15" value={form.duration} onChange={update("duration")} /><Select label="Mode" value={form.mode} onChange={update("mode")} options={["video", "audio", "in_person"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} /></div><Input label="Your timezone" value={form.timezone} onChange={update("timezone")} /><Input label="Location details (in-person only)" value={form.locationDetails} onChange={update("locationDetails")} /><Button type="submit" disabled={saving || !form.startAt}>{saving ? "Requesting…" : "Request booking"}</Button></form>;
}

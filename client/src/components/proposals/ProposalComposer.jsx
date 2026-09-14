import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../utils/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

export function ProposalComposer({ listing, onComplete }) {
  const [skills, setSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ offeredSkillId: "", offeredSessions: 1, requestedSessions: 1, duration: listing.sessionDurations?.[0] || 60, deliveryMode: listing.deliveryMode?.[0] || "video", startAt: "", message: "", optionalCredits: listing.creditsEnabled ? listing.creditCost : 0, paymentAmount: listing.paidEnabled ? listing.price : 0 });
  useEffect(() => { api.get("/user-skills/me").then((response) => { const values = (response.data.data || []).filter((record) => record.teachingEnabled); setSkills(values); setForm((current) => ({ ...current, offeredSkillId: current.offeredSkillId || values[0]?.skill?._id || "" })); }); }, []);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (sendNow) => {
    if (!form.offeredSkillId) return toast.error("Add a teaching skill to your profile first");
    setSaving(true);
    try {
      const duration = Number(form.duration);
      const proposedSchedule = form.startAt ? [{
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(new Date(form.startAt).getTime() + duration * 60_000).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }] : [];
      const response = await api.post("/proposals", {
        recipientId: listing.owner._id,
        listingId: listing._id,
        offeredSkillId: form.offeredSkillId,
        requestedSkillId: listing.skill._id,
        offeredSessions: Number(form.offeredSessions),
        requestedSessions: Number(form.requestedSessions),
        duration,
        proposedSchedule,
        deliveryMode: form.deliveryMode,
        message: form.message,
        optionalCredits: Number(form.optionalCredits || 0),
        optionalPayment: Number(form.paymentAmount) > 0 ? { amount: Number(form.paymentAmount), currency: listing.currency || "USD" } : null,
      });
      if (sendNow) await api.post(`/proposals/${response.data.data._id}/submit`);
      toast.success(sendNow ? "Proposal sent" : "Draft saved");
      onComplete?.();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save proposal");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <Select label="Skill you will offer" value={form.offeredSkillId} onChange={update("offeredSkillId")} options={skills.map((record) => ({ value: record.skill?._id, label: record.skill?.name }))} placeholder="Choose your teaching skill" />
    <div className="grid gap-3 sm:grid-cols-2"><Input label="Sessions you offer" type="number" min="0" max="100" value={form.offeredSessions} onChange={update("offeredSessions")} /><Input label="Sessions you request" type="number" min="1" max="100" value={form.requestedSessions} onChange={update("requestedSessions")} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><Select label="Duration" value={String(form.duration)} onChange={update("duration")} options={(listing.sessionDurations || [30, 60, 90]).map((value) => ({ value: String(value), label: `${value} minutes` }))} /><Select label="Delivery" value={form.deliveryMode} onChange={update("deliveryMode")} options={(listing.deliveryMode || ["video"]).map((value) => ({ value, label: value.replaceAll("_", " ") }))} /></div>
    <Input label="Proposed start (optional)" type="datetime-local" value={form.startAt} onChange={update("startAt")} />
    <Textarea label="Message" rows={3} value={form.message} onChange={update("message")} />
    <div className="grid gap-3 sm:grid-cols-2"><Input label="Optional SkillCredits" type="number" min="0" value={form.optionalCredits} onChange={update("optionalCredits")} /><Input label={`Optional payment (${listing.currency || "USD"})`} type="number" min="0" step="0.01" value={form.paymentAmount} onChange={update("paymentAmount")} /></div>
    <div className="flex gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={() => save(false)}>Save draft</Button><Button type="button" disabled={saving} onClick={() => save(true)}>{saving ? "Saving…" : "Send proposal"}</Button></div>
  </div>;
}

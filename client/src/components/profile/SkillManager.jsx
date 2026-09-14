import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../utils/api";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";

const typeOptions = [
  { value: "teach", label: "I can teach" },
  { value: "learn", label: "I want to learn" },
  { value: "both", label: "Teach and learn" },
];
const proficiencyOptions = ["Beginner", "Intermediate", "Advanced", "Expert"];

export function SkillManager() {
  const [catalog, setCatalog] = useState([]);
  const [userSkills, setUserSkills] = useState([]);
  const [form, setForm] = useState({ skillId: "", type: "learn", proficiency: "Beginner" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evidenceDrafts, setEvidenceDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const [catalogResponse, profileResponse] = await Promise.all([
        api.get("/skills", { params: { limit: 50, sort: "name", order: "asc" } }),
        api.get("/user-skills/me"),
      ]);
      setCatalog(catalogResponse.data.data || []);
      setUserSkills(profileResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableSkills = catalog.filter(
    (skill) => !userSkills.some((record) => record.skill?._id === skill._id)
  );

  const addSkill = async (event) => {
    event.preventDefault();
    if (!form.skillId) return toast.error("Choose a skill");
    setSaving(true);
    try {
      await api.post("/user-skills/me", form);
      setForm({ skillId: "", type: "learn", proficiency: "Beginner" });
      await load();
      toast.success("Skill added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add skill");
    } finally {
      setSaving(false);
    }
  };

  const updateSkill = async (id, changes) => {
    try {
      await api.patch(`/user-skills/me/${id}`, changes);
      await load();
      toast.success("Skill updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update skill");
      await load();
    }
  };

  const addEvidence = async (record) => {
    const url = evidenceDrafts[record._id]?.trim();
    if (!url) return;
    try {
      await api.patch(`/user-skills/me/${record._id}`, { evidence: [...(record.evidence || []), { type: "link", label: "Verification evidence", url }] });
      setEvidenceDrafts((value) => ({ ...value, [record._id]: "" }));
      await load(); toast.success("Evidence added");
    } catch (error) { toast.error(error.response?.data?.message || "Could not add evidence"); }
  };

  const requestVerification = async (record) => {
    try { await api.post(`/user-skills/me/${record._id}/request-verification`); await load(); toast.success("Verification requested"); }
    catch (error) { toast.error(error.response?.data?.message || "Could not request verification"); }
  };

  const removeSkill = async (id) => {
    try {
      await api.delete(`/user-skills/me/${id}`);
      setUserSkills((current) => current.filter((record) => record._id !== id));
      toast.success("Skill removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove skill");
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold text-text-primary">Skills</h2>
        <p className="mt-1 text-sm text-text-secondary">Structured skills improve search and matching quality.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-text-secondary" role="status">Loading skills…</p>
        ) : (
          <>
            <form onSubmit={addSkill} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <Select
                label="Skill"
                value={form.skillId}
                onChange={(event) => setForm((value) => ({ ...value, skillId: event.target.value }))}
                options={availableSkills.map((skill) => ({ value: skill._id, label: skill.name }))}
                placeholder={availableSkills.length ? "Choose a skill" : "No more skills available"}
                disabled={!availableSkills.length}
              />
              <Select
                label="Goal"
                value={form.type}
                onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))}
                options={typeOptions}
              />
              <div>
                <Select
                  label="Proficiency"
                  value={form.proficiency}
                  onChange={(event) => setForm((value) => ({ ...value, proficiency: event.target.value }))}
                  options={proficiencyOptions}
                />
                <Button type="submit" className="mt-3 w-full" disabled={saving || !form.skillId}>
                  {saving ? "Adding…" : "Add skill"}
                </Button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {userSkills.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">
                  No structured skills yet. Add one from the catalog above.
                </p>
              )}
              {userSkills.map((record) => (
                <div key={record._id} className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px_auto] sm:items-end">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{record.skill?.name || "Archived skill"}</p><Badge variant={record.verificationStatus === "verified" ? "success" : record.verificationStatus === "rejected" ? "danger" : record.verificationStatus === "pending" ? "warning" : "default"}>{record.verificationStatus}</Badge></div>
                    <p className="text-xs text-text-secondary">{record.skill?.category}</p>
                  </div>
                  <Select
                    label="Goal"
                    value={record.type}
                    onChange={(event) => updateSkill(record._id, { type: event.target.value })}
                    options={typeOptions}
                  />
                  <Select
                    label="Level"
                    value={record.proficiency}
                    onChange={(event) => updateSkill(record._id, { proficiency: event.target.value })}
                    options={proficiencyOptions}
                  />
                  <Button type="button" variant="danger" onClick={() => removeSkill(record._id)} aria-label={`Remove ${record.skill?.name || "skill"}`}>
                    Remove
                  </Button>
                  </div>
                  {record.teachingEnabled && <div className="mt-4 border-t border-border pt-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><Input label="Verification evidence URL" type="url" placeholder="https://portfolio.example/work" value={evidenceDrafts[record._id] || ""} onChange={(event) => setEvidenceDrafts((value) => ({ ...value, [record._id]: event.target.value }))} /><Button type="button" variant="secondary" disabled={!evidenceDrafts[record._id]?.trim()} onClick={() => addEvidence(record)}>Add evidence</Button>{!["pending", "verified"].includes(record.verificationStatus) && <Button type="button" disabled={!record.evidence?.length} onClick={() => requestVerification(record)}>Request verification</Button>}</div><p className="mt-2 text-xs text-text-secondary">{record.evidence?.length || 0} evidence link(s). Editing this skill resets a prior verification for integrity.</p>{record.verificationNote && <p className="mt-1 text-xs text-text-secondary">Reviewer note: {record.verificationNote}</p>}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

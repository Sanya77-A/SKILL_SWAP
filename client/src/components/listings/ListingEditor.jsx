import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";

const modes = [
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "in_person", label: "In person" },
];
const durations = [30, 60, 90, 120];

export function ListingEditor({ listing, teachingSkills, onSubmit, saving }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const creditsEnabled = watch("creditsEnabled");
  const paidEnabled = watch("paidEnabled");

  useEffect(() => {
    reset({
      skillId: listing?.skill?._id || teachingSkills[0]?.skill?._id || "",
      title: listing?.title || "",
      description: listing?.description || "",
      learningOutcomes: (listing?.learningOutcomes || []).join("\n"),
      prerequisites: (listing?.prerequisites || []).join("\n"),
      experienceLevel: listing?.experienceLevel || "all_levels",
      deliveryMode: listing?.deliveryMode || ["video"],
      sessionDurations: (listing?.sessionDurations || [60]).map(String),
      exchangeEnabled: listing?.exchangeEnabled ?? true,
      creditsEnabled: listing?.creditsEnabled ?? false,
      paidEnabled: listing?.paidEnabled ?? false,
      creditCost: listing?.creditCost || 50,
      price: listing?.price || 0,
      currency: listing?.currency || "USD",
      capacity: listing?.capacity || 1,
    });
  }, [listing, teachingSkills, reset]);

  const submit = (values) => onSubmit({
    ...values,
    learningOutcomes: values.learningOutcomes.split("\n").map((value) => value.trim()).filter(Boolean),
    prerequisites: values.prerequisites.split("\n").map((value) => value.trim()).filter(Boolean),
    deliveryMode: Array.isArray(values.deliveryMode) ? values.deliveryMode : [values.deliveryMode].filter(Boolean),
    sessionDurations: (Array.isArray(values.sessionDurations) ? values.sessionDurations : [values.sessionDurations]).filter(Boolean).map(Number),
    creditCost: Number(values.creditCost || 0),
    price: Number(values.price || 0),
    capacity: Number(values.capacity || 1),
  });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Select
        label="Skill"
        error={errors.skillId?.message}
        options={teachingSkills.map((record) => ({ value: record.skill?._id, label: record.skill?.name }))}
        {...register("skillId", { required: "Choose a teaching skill" })}
      />
      <Input label="Listing title" error={errors.title?.message} {...register("title", { required: "Required", minLength: { value: 8, message: "Use at least 8 characters" } })} />
      <Textarea label="Description" error={errors.description && "Use at least 30 characters."} {...register("description", { required: true, minLength: 30 })} rows={5} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea label="Learning outcomes (one per line)" {...register("learningOutcomes", { required: true })} rows={4} />
        <Textarea label="Prerequisites (one per line)" {...register("prerequisites")} rows={4} />
      </div>
      <Select
        label="Learner level"
        options={[
          { value: "all_levels", label: "All levels" }, { value: "beginner", label: "Beginner" },
          { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" },
          { value: "expert", label: "Expert" },
        ]}
        {...register("experienceLevel")}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-secondary">Delivery modes</legend>
        <div className="flex flex-wrap gap-4">{modes.map((mode) => <label key={mode.value} className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" value={mode.value} {...register("deliveryMode")} />{mode.label}</label>)}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-secondary">Session durations</legend>
        <div className="flex flex-wrap gap-4">{durations.map((duration) => <label key={duration} className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" value={duration} {...register("sessionDurations")} />{duration} min</label>)}</div>
      </fieldset>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-2 text-sm font-medium text-text-primary">Ways to book</legend>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" {...register("exchangeEnabled")} />Skill exchange</label>
          <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" {...register("creditsEnabled")} />SkillCredits</label>
          {creditsEnabled && <Input label="Credit cost" type="number" min="1" {...register("creditCost")} />}
          <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" {...register("paidEnabled")} />Paid session</label>
          {paidEnabled && <div className="grid grid-cols-[1fr_100px] gap-3"><Input label="Price" type="number" min="0.01" step="0.01" {...register("price")} /><Input label="Currency" maxLength={3} {...register("currency")} /></div>}
        </div>
      </fieldset>
      <Input label="Capacity per session" type="number" min="1" max="100" {...register("capacity")} />
      <Button type="submit" disabled={saving || !teachingSkills.length}>{saving ? "Saving…" : listing ? "Save changes" : "Create draft"}</Button>
      {!teachingSkills.length && <p className="text-sm text-warning">Add at least one skill you can teach before creating a listing.</p>}
    </form>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchMe } from "../features/auth/authSlice";
import { api } from "../utils/api";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { ChangePasswordForm } from "../components/security/ChangePasswordForm";
import { SkillManager } from "../components/profile/SkillManager";

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || "",
        username: user.username || "",
        headline: user.headline || "",
        bio: user.bio || "",
        occupation: user.occupation || "",
        company: user.company || "",
        university: user.university || "",
        location: user.location || "",
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        website: user.website || "",
        github: user.github || "",
        linkedin: user.linkedin || "",
        coverImage: user.coverImage || "",
        languages: (user.languages || []).join(", "),
        availability: (user.availability || []).join(", "),
        learningGoals: (user.learningGoals || []).join("\n"),
        portfolioLinks: (user.portfolioLinks || []).map((link) => link.url).join("\n"),
        preferredLearningMode: user.preferredLearningMode || "online",
        preferredTeachingMode: user.preferredTeachingMode || "online",
        preferredExchangeModels: user.preferredExchangeModels || ["exchange"],
        maxCreditCost: user.maxCreditCost ?? "",
        maxSessionPrice: user.maxSessionPrice ?? "",
        preferredCurrency: user.preferredCurrency || "USD",
        visibility: user.visibility || "members",
        experienceLevel: user.experienceLevel || "intermediate",
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    if (data.profileImage?.[0]?.size > 4 * 1024 * 1024) {
      toast.error("Profile images must be 4 MB or smaller.");
      return;
    }
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("username", data.username);
    formData.append("headline", data.headline || "");
    formData.append("bio", data.bio || "");
    formData.append("occupation", data.occupation || "");
    formData.append("company", data.company || "");
    formData.append("university", data.university || "");
    formData.append("location", data.location || "");
    formData.append("timezone", data.timezone || "UTC");
    formData.append("website", data.website || "");
    formData.append("github", data.github || "");
    formData.append("linkedin", data.linkedin || "");
    formData.append("coverImage", data.coverImage || "");
    formData.append("languages", JSON.stringify((data.languages || "").split(",").map((value) => value.trim()).filter(Boolean)));
    formData.append("availability", JSON.stringify((data.availability || "").split(",").map((value) => value.trim()).filter(Boolean)));
    formData.append("learningGoals", JSON.stringify((data.learningGoals || "").split("\n").map((value) => value.trim()).filter(Boolean)));
    formData.append("portfolioLinks", JSON.stringify((data.portfolioLinks || "").split("\n").map((url) => url.trim()).filter(Boolean).map((url) => ({ label: "Portfolio", url }))));
    formData.append("preferredLearningMode", data.preferredLearningMode);
    formData.append("preferredTeachingMode", data.preferredTeachingMode);
    formData.append("preferredExchangeModels", JSON.stringify(Array.isArray(data.preferredExchangeModels) ? data.preferredExchangeModels : [data.preferredExchangeModels].filter(Boolean)));
    formData.append("maxCreditCost", data.maxCreditCost ?? "");
    formData.append("maxSessionPrice", data.maxSessionPrice ?? "");
    formData.append("preferredCurrency", data.preferredCurrency || "USD");
    formData.append("visibility", data.visibility);
    formData.append("experienceLevel", data.experienceLevel);
    if (data.profileImage?.[0]) formData.append("profileImage", data.profileImage[0]);
    try {
      await api.put("/users/me", formData, { headers: { "Content-Type": "multipart/form-data" } });
      dispatch(fetchMe()); // refresh auth user
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  if (!user) return <p className="text-text-secondary">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">Profile</h1>
          <p className="text-text-secondary text-sm">Edit your professional profile and skills.</p>
        </div>
        {user.username && <Button variant="secondary" asChild><Link to={`/@${user.username}`}>Preview public profile</Link></Button>}
      </div>
      <div className="mb-6" aria-label={`Profile ${user.profileCompleteness || 0}% complete`}>
        <div className="mb-1 flex justify-between text-xs text-text-secondary"><span>Profile completeness</span><span>{user.profileCompleteness || 0}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${user.profileCompleteness || 0}%` }} /></div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar src={user.profileImage?.startsWith("http") ? user.profileImage : user.profileImage ? `/api${user.profileImage}` : undefined} name={user.name} size="lg" />
            <div>
              <label htmlFor="profile-photo" className="block text-sm font-medium text-text-secondary mb-1">Profile photo</label>
              <input id="profile-photo" type="file" accept="image/*" {...register("profileImage")} className="w-full text-sm text-text-secondary file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-surface-2 file:text-text-primary" />
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Name" error={errors.name && "Required"} {...register("name", { required: true })} />
            <Input label="Username" error={errors.username?.message} {...register("username", {
              required: "Required",
              minLength: { value: 3, message: "Use at least 3 characters" },
              pattern: { value: /^[a-z0-9_]+$/, message: "Use lowercase letters, numbers, and underscores" },
            })} />
            <Input label="Headline" {...register("headline")} />
            <Textarea label="Bio" {...register("bio")} rows={3} />
            <Input label="Location" {...register("location")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Occupation" {...register("occupation")} />
              <Input label="Company" {...register("company")} />
            </div>
            <Input label="University" {...register("university")} />
            <Input label="Timezone" {...register("timezone")} />
            <Input label="Languages (comma-separated)" {...register("languages")} />
            <Input label="Availability (comma-separated)" {...register("availability")} />
            <Input label="Cover image URL" type="url" {...register("coverImage")} />
            <Input label="Website" type="url" {...register("website")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="GitHub profile" type="url" {...register("github")} />
              <Input label="LinkedIn profile" type="url" {...register("linkedin")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="preferred-learning-mode" className="block text-sm font-medium text-text-secondary mb-1.5">Preferred learning mode</label>
                <select id="preferred-learning-mode" {...register("preferredLearningMode")} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent">
                  <option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label htmlFor="preferred-teaching-mode" className="block text-sm font-medium text-text-secondary mb-1.5">Preferred teaching mode</label>
                <select id="preferred-teaching-mode" {...register("preferredTeachingMode")} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent">
                  <option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="learning-goals" className="block text-sm font-medium text-text-secondary mb-1.5">Learning goals (one per line)</label>
              <textarea id="learning-goals" {...register("learningGoals")} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label htmlFor="portfolio-links" className="block text-sm font-medium text-text-secondary mb-1.5">Portfolio URLs (one per line)</label>
              <textarea id="portfolio-links" {...register("portfolioLinks")} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label htmlFor="profile-visibility" className="block text-sm font-medium text-text-secondary mb-1.5">Profile visibility</label>
              <select id="profile-visibility" {...register("visibility")} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent">
                <option value="public">Public</option>
                <option value="members">Members only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <fieldset className="rounded-xl border border-border p-4">
              <legend className="px-2 text-sm font-medium text-text-primary">Preferred booking models</legend>
              <div className="flex flex-wrap gap-4">{[["exchange", "Skill swap"], ["credits", "SkillCredits"], ["paid", "Paid"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" value={value} {...register("preferredExchangeModels")} />{label}</label>)}</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3"><Input label="Max credits" type="number" min="0" {...register("maxCreditCost")} /><Input label="Max session price" type="number" min="0" step="0.01" {...register("maxSessionPrice")} /><Input label="Currency" maxLength={3} {...register("preferredCurrency")} /></div>
            </fieldset>
            <div>
              <label htmlFor="experience-level" className="block text-sm font-medium text-text-secondary mb-1.5">Experience level</label>
              <select id="experience-level" {...register("experienceLevel")} className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:ring-2 focus:ring-accent">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
      <SkillManager />
      <ChangePasswordForm />
    </div>
  );
}

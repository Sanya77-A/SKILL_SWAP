import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { ArrowRight, Sparkles } from "lucide-react";
import { updateProfile } from "../features/user/userSlice";
import { api } from "../utils/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";

export default function OnboardingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [skillsOffered, setSkillsOffered] = useState("");
  const [skillsWanted, setSkillsWanted] = useState("");
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const availabilityOptions = ["weekdays", "weekends", "flexible", "anytime"];

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.put("/users/me", {
        skillsOffered: skillsOffered.split(",").map((value) => value.trim()).filter(Boolean),
        skillsWanted: skillsWanted.split(",").map((value) => value.trim()).filter(Boolean),
        availability: availability.length ? availability : ["flexible"],
      });
      dispatch(updateProfile.fulfilled({}));
      toast.success("Profile updated");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not complete your profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader icon={Sparkles} title="Complete your profile" description="A few details help SkillSwap find relevant people and times." />
      <Card><CardContent>
        <form onSubmit={submit} className="space-y-5">
          <Input label="Skills I can teach" helperText="Separate multiple skills with commas." value={skillsOffered} onChange={(event) => setSkillsOffered(event.target.value)} placeholder="React, product design" />
          <Input label="Skills I want to learn" helperText="Separate multiple skills with commas." value={skillsWanted} onChange={(event) => setSkillsWanted(event.target.value)} placeholder="Python, public speaking" />
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-text-primary">Availability</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {availabilityOptions.map((option) => (
                <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary">
                  <input type="checkbox" checked={availability.includes(option)} onChange={(event) => setAvailability((items) => event.target.checked ? [...items, option] : items.filter((item) => item !== option))} />
                  <span className="capitalize">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="lg" disabled={loading} className="w-full">{loading ? "Saving..." : "Save and open dashboard"}<ArrowRight className="h-4 w-4" /></Button>
        </form>
      </CardContent></Card>
    </div>
  );
}

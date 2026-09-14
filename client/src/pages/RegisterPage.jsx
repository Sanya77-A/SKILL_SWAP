import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { register as registerUser } from "../features/auth/authSlice";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { InlineNotice } from "../components/ui/InlineNotice";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters").max(100),
  location: z.string().max(200).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

function PasswordStrength({ password }) {
  if (!password) return null;
  const len = password.length >= 8;
  const hasNum = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const score = [len, hasNum, hasLetter].filter(Boolean).length;
  return (
    <div className="flex gap-1 mt-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i <= score ? (score >= 2 ? "bg-accent-2" : "bg-warning") : "bg-surface-2"}`}
        />
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, databaseMode } = useSelector((s) => s.auth);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", location: "", experienceLevel: "intermediate" },
  });

  const password = watch("password");

  const onSubmit = async (data) => {
    setSubmitted(true);
    const result = await dispatch(registerUser(data));
    if (registerUser.fulfilled.match(result)) {
      toast.success("Account created");
      navigate("/onboarding", { replace: true });
    } else {
      toast.error(result.payload || "Registration failed");
    }
    setSubmitted(false);
  };

  return (
    <AuthLayout title="Create account" subtitle="Join SkillSwap and start swapping skills">
      {databaseMode === "demo" && <div className="mt-8 space-y-4"><InlineNotice title="Registration needs persistent storage" variant="warning">This deployment is running in read-only demo mode. It will not create or pretend to save an account.</InlineNotice><Button asChild className="w-full"><Link to="/login">Open a demo workspace</Link></Button></div>}
      {databaseMode !== "demo" && <>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input label="Name" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <div>
          <Input label="Password (min 8)" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <PasswordStrength password={password} />
        </div>
        <Input label="Location (optional)" autoComplete="address-level2" {...register("location")} />
        <Select
          label="Experience level"
          options={[
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
            { value: "expert", label: "Expert" },
          ]}
          {...register("experienceLevel")}
        />
        <Button type="submit" disabled={loading || submitted} className="w-full" size="lg">
          {loading || submitted ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
      </p>
      </>}
    </AuthLayout>
  );
}

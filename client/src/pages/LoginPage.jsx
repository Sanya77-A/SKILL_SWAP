import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { demoLogin, login } from "../features/auth/authSlice";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { InlineNotice } from "../components/ui/InlineNotice";

const schema = z.object({ email: z.string().email("Invalid email"), password: z.string().min(1, "Password required") });

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";
  const { loading, databaseMode } = useSelector((s) => s.auth);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => {
    setSubmitted(true);
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      toast.success("Logged in");
      navigate(from, { replace: true });
    } else {
      toast.error(result.payload || "Login failed");
    }
    setSubmitted(false);
  };

  const openDemo = async (role) => {
    setSubmitted(true);
    const result = await dispatch(demoLogin(role));
    if (demoLogin.fulfilled.match(result)) {
      toast.success("Demo workspace opened");
      navigate("/dashboard", { replace: true });
    } else {
      toast.error(result.payload || "Demo login failed");
    }
    setSubmitted(false);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      {databaseMode === "demo" && (
        <div className="mt-6 space-y-4">
          <InlineNotice title="Read-only demo deployment">
            Choose a fictional role to explore deterministic sample data. Nothing you do here is saved, and demo admin has no production permissions.
          </InlineNotice>
          <div className="grid gap-2 sm:grid-cols-3">
            {[['user', 'Demo User'], ['mentor', 'Demo Mentor'], ['admin', 'Demo Admin']].map(([role, label]) => (
              <Button key={role} type="button" variant={role === "user" ? "primary" : "secondary"} disabled={loading || submitted} onClick={() => openDemo(role)}>{label}</Button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-text-secondary"><span className="h-px flex-1 bg-border" />Persistent sign in unavailable<span className="h-px flex-1 bg-border" /></div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <Link to="/forgot-password" className="block text-sm font-medium text-accent hover:underline">
          Forgot password?
        </Link>
        <Button type="submit" disabled={loading || submitted || databaseMode === "demo"} className="w-full" size="lg">
          {loading || submitted ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {databaseMode !== "demo" && <p className="mt-6 text-center text-sm text-text-secondary">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-accent hover:underline">Create account</Link>
      </p>}
    </AuthLayout>
  );
}

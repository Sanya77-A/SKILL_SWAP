import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "../utils/api";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineNotice } from "../components/ui/InlineNotice";

const schema = z.object({ password: z.string().min(8, "Use at least 8 characters").max(100) });

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { register, handleSubmit, formState: { errors, isSubmitSuccessful, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  const onSubmit = async (data) => {
    if (!token) return;
    try {
      await api.post("/auth/reset-password", { token, password: data.password });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not reset the password");
      throw error;
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Use a unique password with at least 8 characters.">
      {!token ? (
        <div className="mt-8 space-y-5"><InlineNotice variant="danger" title="Invalid reset link"><p>This link is missing its reset token or is no longer valid.</p></InlineNotice><Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button></div>
      ) : isSubmitSuccessful ? (
        <div className="mt-8 space-y-5"><InlineNotice variant="success" title="Password updated"><p>Your other refresh sessions have been revoked.</p></InlineNotice><Button asChild className="w-full"><Link to="/login">Log in</Link></Button></div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <Input label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update password"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}

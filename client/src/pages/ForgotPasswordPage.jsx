import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { MailCheck } from "lucide-react";
import { api } from "../utils/api";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineNotice } from "../components/ui/InlineNotice";

const schema = z.object({ email: z.string().email("Enter a valid email address") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data) => {
    try {
      await api.post("/auth/forgot-password", data);
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not request a reset link");
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We will send a secure link if the account exists.">
      {sent ? (
        <div className="mt-8 space-y-5">
          <InlineNotice variant="success" title="Check your email"><p>The same confirmation appears whether or not an account exists.</p></InlineNotice>
          <Button asChild variant="secondary" className="w-full"><Link to="/login"><MailCheck className="h-4 w-4" />Back to login</Link></Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send reset link"}</Button>
          <p className="text-center text-sm text-text-secondary"><Link to="/login" className="font-medium text-accent hover:underline">Back to login</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}

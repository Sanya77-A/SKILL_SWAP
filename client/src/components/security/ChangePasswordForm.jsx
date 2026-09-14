import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../utils/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("New password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");

    setLoading(true);
    try {
      await api.patch("/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Password could not be changed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 mt-6">
      <h2 className="font-heading text-lg font-semibold text-text-primary">Security</h2>
      <p className="mt-1 text-sm text-text-secondary">Changing your password signs out your other sessions.</p>
      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? "Changing password..." : "Change password"}</Button>
      </form>
    </Card>
  );
}

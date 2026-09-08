import React, { useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { SuccessMessage } from "@/components/auth/SuccessMessage";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
  successMessage?: string | null;
}

export default function ChangePasswordForm({ serverError, successMessage }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  function validate() {
    const next: typeof errors = {};

    if (!newPassword) {
      next.newPassword = "Password is required";
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      next.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/account/change-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="newPassword"
        label="New password"
        type={showPassword ? "text" : "password"}
        value={newPassword}
        onChange={(v) => {
          setNewPassword(v);
          clearError("newPassword");
        }}
        placeholder="Min. 6 characters"
        error={errors.newPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        label="Confirm new password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your new password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />
      <SuccessMessage message={successMessage} />

      <SubmitButton pendingText="Updating password..." icon={<KeyRound className="size-4" />}>
        Update password
      </SubmitButton>
    </form>
  );
}

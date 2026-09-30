"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/auth";
import { FormError } from "@/components/ui/FormMessage";
import PasswordField from "@/components/ui/PasswordField";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <PasswordField name="currentPassword" label="Senha atual" required autoComplete="current-password" />
      <PasswordField name="newPassword" label="Nova senha" required minLength={4} autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Confirmar nova senha" required autoComplete="new-password" />

      <FormError>{state?.error}</FormError>
      {state?.success && <p className="text-sm font-medium text-green-600">Senha atualizada com sucesso.</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}

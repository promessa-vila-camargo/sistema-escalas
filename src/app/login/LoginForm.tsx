"use client";

import { useActionState, useId } from "react";
import { login } from "@/lib/actions/auth";
import { FormError } from "@/components/ui/FormMessage";
import PasswordField from "@/components/ui/PasswordField";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const erroId = useId();

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-900">Usuário</span>
        <input
          name="username"
          required
          autoFocus
          autoComplete="username"
          className="input"
          aria-describedby={state?.error ? erroId : undefined}
          aria-invalid={state?.error ? true : undefined}
        />
      </label>
      <PasswordField name="password" label="Senha" required autoComplete="current-password" />

      <div id={erroId}>
        <FormError>{state?.error}</FormError>
      </div>

      <button type="submit" disabled={pending} className="btn-primary mt-2 w-full">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

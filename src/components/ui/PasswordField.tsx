"use client";

import { useId, useState } from "react";

/** Campo de senha com o mesmo botão "Ver/Ocultar" em toda a aplicação. */
export default function PasswordField({
  name,
  label,
  required,
  minLength,
  defaultValue,
  autoComplete,
  placeholder,
  autoFocus,
}: {
  name: string;
  label: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  const id = useId();

  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="font-medium text-ink-900">{label}</span>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={ver ? "text" : "password"}
          required={required}
          minLength={minLength}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="input pr-16"
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-pressed={ver}
          aria-label={ver ? `Ocultar ${label.toLowerCase()}` : `Ver ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-orange-600 hover:text-orange-700"
        >
          {ver ? "Ocultar" : "Ver"}
        </button>
      </div>
    </label>
  );
}

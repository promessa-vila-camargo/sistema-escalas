export function FormError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="form-message-error" role="alert" aria-live="polite">
      {children}
    </p>
  );
}

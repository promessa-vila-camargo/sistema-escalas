import Image from "next/image";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login | Escalas Promessa",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 overflow-x-hidden px-4 py-10 sm:gap-8 sm:py-14">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="/logo-icon.png"
          alt="Promessa Vila Camargo"
          width={96}
          height={96}
          priority
          className="h-14 w-14 rounded-full drop-shadow-sm"
        />
        <span className="font-heading text-base font-extrabold text-ink-900">PROMESSA</span>
        <span className="text-[11px] font-bold italic uppercase tracking-wide text-orange-600">
          Vila Camargo
        </span>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-brand-100 bg-white shadow-soft-lift">
        <div className="gradient-bar rounded-none" />
        <div className="p-6 sm:p-10">
          <h2 className="font-heading text-xl font-extrabold text-ink-900">Entrar</h2>
          <p className="mt-1 mb-6 text-sm text-ink-600">Acesse para continuar as escalas da sua igreja.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

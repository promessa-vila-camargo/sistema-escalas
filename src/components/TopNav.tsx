"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/auth/dal";

export default function TopNav({
  user,
  tabs,
}: {
  user: CurrentUser;
  tabs?: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full" />
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-[15px] font-extrabold text-ink-900">PROMESSA</span>
            <span className="text-[9px] font-bold italic uppercase tracking-wide text-orange-600">
              Vila Camargo
            </span>
          </div>
          <span className="hidden h-7 w-px bg-brand-200 sm:block" />
          <span className="hidden text-sm font-semibold text-ink-600 sm:block">Escalas</span>
        </div>

        {tabs && (
          <nav className="flex items-center gap-1 rounded-lg bg-brand-50 p-1">
            {tabs.map((tab) => {
              const active = tab.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    "rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors " +
                    (active ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900")
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-ink-600">
            Olá, <b className="text-ink-900">{user.nome}</b>{" "}
            <span className="badge-neutral">{user.role === "ADMIN" ? "Admin" : "Voluntário"}</span>
          </span>
          <Link href="/conta" className="link">
            Minha conta
          </Link>
          <form action={logout}>
            <button type="submit" className="btn-ghost">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

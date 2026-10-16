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
    <header className="no-print sticky top-0 z-20 border-b border-line bg-white/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 pb-2 sm:px-6 md:h-16 md:flex-nowrap md:py-0">
        <Link href="/" className="flex flex-none items-center gap-3" aria-label="Início — Promessa Vila Camargo">
          {/* Logomarca original, proporção preservada (1647×417). */}
          <Image src="/logo.png" alt="Promessa Vila Camargo" width={1647} height={417} priority className="h-7 w-auto sm:h-8" />
          <span className="hidden h-6 w-px bg-line-strong lg:block" />
          <span className="hidden text-[13px] font-semibold tracking-[0.08em] text-ink-500 uppercase lg:block">Escalas</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 text-[13px] md:order-last">
          <span className="mr-1 hidden text-ink-600 sm:inline">
            <b className="font-semibold text-ink-900">{user.nome}</b>
            <span className="ml-1.5 text-ink-400">· {user.role === "ADMIN" ? "Admin" : "Voluntário"}</span>
          </span>
          <Link href="/conta" className="btn-ghost btn-sm">
            Minha conta
          </Link>
          <form action={logout}>
            <button type="submit" className="btn-ghost btn-sm">
              Sair
            </button>
          </form>
        </div>

        {tabs && (
          <nav className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0">
            {tabs.map((tab) => {
              const active = tab.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "relative flex h-10 flex-none items-center rounded-[9px] px-3 text-[13.5px] font-semibold transition-colors md:h-16 md:rounded-none " +
                    (active
                      ? "text-ink-900 after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-orange-500"
                      : "text-ink-500 hover:text-ink-900")
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

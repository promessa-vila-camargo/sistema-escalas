import { verifyAdmin } from "@/lib/auth/dal";
import TopNav from "@/components/TopNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifyAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        user={user}
        tabs={[
          { href: "/admin", label: "Início" },
          { href: "/admin/escala", label: "Escala" },
          { href: "/admin/pessoas", label: "Pessoas" },
        ]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">{children}</main>
    </div>
  );
}

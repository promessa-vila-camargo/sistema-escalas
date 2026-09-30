import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";

export default async function HomePage() {
  const user = await verifySession();
  redirect(user.role === "ADMIN" ? "/admin" : "/escala");
}

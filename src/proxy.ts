import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const LOGIN_PATH = "/login";

/**
 * Só checa se existe uma sessão válida (JWT assinado, não expirado) — não
 * decide papel/funções/se a conta ainda está ativa, porque isso exige ir no
 * banco e o proxy roda antes disso. Cada página protegida faz essa checagem
 * de verdade via verifySession()/verifyAdmin() em src/lib/auth/dal.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);
  const isAuthenticated = Boolean(session?.userId);
  const isLoginPage = pathname === LOGIN_PATH;

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};

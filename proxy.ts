import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: refresh Supabase session cookies on every request
 * and guard /admin/* (except /admin/login): unauthenticated visitors
 * are redirected to the login page. Role checks stay in the protected
 * layout + RPCs (they need the database; middleware stays fast).
 *
 * Degrades open when Supabase is unlinked so local development without
 * credentials keeps working.
 */
export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  if (url === "" || anonKey === "") {
    return response;
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      pathname.startsWith("/admin") &&
      !pathname.startsWith("/admin/login") &&
      !user
    ) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return response;
  } catch {
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

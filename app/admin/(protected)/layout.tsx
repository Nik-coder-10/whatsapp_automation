import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";

/**
 * Protected admin layout: every /admin/* route (except /admin/login,
 * which lives outside this group) verifies the session + role
 * server-side. Unauthenticated → 401-style sign-in prompt;
 * authenticated non-admin → 403 panel. No admin UI renders otherwise.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    const title =
      status === 401 ? "Sign in required" : "Access denied";
    const message =
      status === 401
        ? "This area is for Trolift staff. Please sign in."
        : "Your account does not have admin access.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 text-center">
          <p className="text-lg font-extrabold tracking-tight text-brand-900">
            TROLIFT <span className="text-xs font-bold text-zinc-500">Admin</span>
          </p>
          <h1 className="mt-2 text-xl font-bold text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">{message}</p>
          <a
            href="/admin/login"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-brand-800 px-5 text-sm font-bold text-white hover:bg-brand-700"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

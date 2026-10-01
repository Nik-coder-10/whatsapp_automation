"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminHeader } from "@/components/layout/admin/AdminHeader";
import { AdminSidebar } from "@/components/layout/admin/AdminSidebar";

/**
 * Authenticated admin shell: static sidebar on desktop (lg+), slide-in
 * drawer with overlay on mobile/tablet. Escape closes the drawer.
 */
export function AdminShell({
  title,
  subtitle,
  activeHref,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  activeHref: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer ]);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white p-3 lg:block">
        <p className="px-3 py-2 text-base font-extrabold tracking-tight text-brand-900">
          TROLIFT <span className="text-xs font-bold text-zinc-500">Admin</span>
        </p>
        <AdminSidebar activeHref={activeHref} />
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-950/60"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-3 shadow-xl">
            <div className="flex items-center justify-between px-1 py-1">
              <p className="px-2 text-base font-extrabold tracking-tight text-brand-900">
                TROLIFT <span className="text-xs font-bold text-zinc-500">Admin</span>
              </p>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Close admin navigation"
                className="cursor-pointer rounded p-2 text-zinc-600 hover:bg-zinc-100"
              >
                <span aria-hidden className="block text-lg leading-none">×</span>
              </button>
            </div>
            <AdminSidebar activeHref={activeHref} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          title={title}
          subtitle={subtitle}
          onMenu={() => setDrawer(true)}
          actions={actions}
        />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

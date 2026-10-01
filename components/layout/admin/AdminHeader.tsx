import type { ReactNode } from "react";

/** Admin top bar: menu button (mobile), title, row actions. */
export function AdminHeader({
  title,
  subtitle,
  onMenu,
  actions,
}: {
  title: string;
  subtitle?: string;
  onMenu: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open admin navigation"
        className="cursor-pointer rounded p-2 text-zinc-700 hover:bg-zinc-100 lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-zinc-900">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

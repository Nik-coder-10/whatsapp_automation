"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PartnerDialog, PartnerToggle } from "@/components/admin/delivery/PartnerManager";
import type { AdminPartner } from "@/lib/admin/delivery";

/** Partners section: table + create/edit dialog + toggles. */
export function PartnersSection({ partners }: { partners: AdminPartner[] }) {
  const [editing, setEditing] = useState<AdminPartner | "new" | null>(null);

  return (
    <section aria-label="Delivery partners" className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">1. Delivery partners</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          + New partner
        </Button>
      </div>
      {editing ? (
        <PartnerDialog
          partner={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {partners.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No delivery partners yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {partners.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900">
                  {p.name}{" "}
                  <span className="font-normal text-zinc-500">
                    · priority {p.priority} · {p.rateCount} {p.rateCount === 1 ? "rate" : "rates"}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                  {p.isActive ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                  {p.contactPhone ? (
                    <span className="text-xs text-zinc-500">{p.contactPhone}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Edit
                </button>
                <PartnerToggle partner={p} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        Lower priority wins; ties break on charge.
      </p>
    </section>
  );
}

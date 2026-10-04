"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { RateDeleteButton, RateDialog } from "@/components/admin/delivery/RateManager";
import { formatMoney } from "@/lib/orders/pricing";
import type { AdminPartner, AdminRateRow } from "@/lib/admin/delivery";

export interface RatesView {
  rates: AdminRateRow[];
  total: number;
  page: number;
  totalPages: number;
  base: Record<string, string | undefined>;
}

/** Pincode rates: GET filters, table, create/edit dialog, pagination. */
export function RatesSection({
  view,
  partners,
  filters,
}: {
  view: RatesView;
  partners: AdminPartner[];
  filters: { q?: string; partnerId?: string; serviceable?: boolean };
}) {
  const [editing, setEditing] = useState<AdminRateRow | "new" | null>(null);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(view.base)) {
      if (v) params.set(k, v);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs === "" ? "/admin/delivery" : `/admin/delivery?${qs}#rates`;
  };

  const selectCls =
    "h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-brand-700";

  return (
    <section aria-label="Pincode rates" id="rates" className="scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">2. Pincode rates</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          + New rate
        </Button>
      </div>
      {editing ? (
        <RateDialog
          partners={partners}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <form method="get" action="/admin/delivery" aria-label="Search rates" className="mt-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rq" className="text-sm font-semibold text-zinc-800">
              Pincode
            </label>
            <input
              id="rq"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-700"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rpartner" className="text-sm font-semibold text-zinc-800">
              Partner
            </label>
            <select
              id="rpartner"
              name="partner"
              defaultValue={filters.partnerId ?? ""}
              className={selectCls}
            >
              <option value="">All</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rsvc" className="text-sm font-semibold text-zinc-800">
              Serviceable
            </label>
            <select
              id="rsvc"
              name="serviceable"
              defaultValue={
                filters.serviceable === undefined
                  ? ""
                  : filters.serviceable
                    ? "true"
                    : "false"
              }
              className={selectCls}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-10 cursor-pointer items-center rounded-md bg-brand-800 px-4 text-sm font-bold text-white hover:bg-brand-700"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4">
        {view.rates.length === 0 ? (
          <EmptyState title="No rates found" message="Add rates manually or via CSV import below." />
        ) : (
          <>
            <p role="status" className="mb-2 text-sm text-zinc-600">
              {view.total} {view.total === 1 ? "rule" : "rules"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 uppercase">
                    <th scope="col" className="py-2 pr-3 font-bold">Pincode</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Partner</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Serves</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Charge</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Window / ETA</th>
                    <th scope="col" className="py-2 font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.rates.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="py-2.5 pr-3 font-mono font-bold text-zinc-900">{r.pincode}</td>
                      <td className="py-2.5 pr-3 text-zinc-700">
                        {r.partnerName}
                        {!r.partnerActive ? (
                          <span className="ml-1 text-xs text-zinc-400">(inactive)</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.serviceable ? (
                          <Badge tone="success">Yes</Badge>
                        ) : (
                          <Badge tone="neutral">No</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold whitespace-nowrap text-zinc-900">
                        {formatMoney({ amountPaise: r.chargePaise, currency: "INR" })}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-zinc-500">
                        {r.minOrderPaise !== null || r.maxOrderPaise !== null
                          ? `₹${((r.minOrderPaise ?? 0) / 100).toLocaleString("en-IN")}–₹${r.maxOrderPaise === null ? "∞" : (r.maxOrderPaise / 100).toLocaleString("en-IN")}`
                          : "—"}
                        {r.etaMinDays !== null ? ` · ${r.etaMinDays}–${r.etaMaxDays ?? r.etaMinDays}d` : null}
                      </td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="cursor-pointer rounded p-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                          >
                            Edit
                          </button>
                          <RateDeleteButton rateId={r.id} label={`${r.pincode} / ${r.partnerName}`} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {view.totalPages > 1 ? (
              <nav aria-label="Rate pages" className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <span className="text-sm text-zinc-600">
                  Page {view.page} of {view.totalPages}
                </span>
                {view.page < view.totalPages ? (
                  <Link
                    href={pageHref(view.page + 1)}
                    className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    Next →
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

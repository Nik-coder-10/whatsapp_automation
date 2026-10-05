"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { formatMoney } from "@/lib/orders/pricing";
import type { AdminCategoryRule } from "@/lib/admin/delivery";
import type { ApiResponse } from "@/types/api";

/** Flat per-order handling surcharges keyed by product category. */
export function CategoryRulesSection({
  rules,
  categories,
}: {
  rules: AdminCategoryRule[];
  categories: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", surchargeRupees: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delivery/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setOpen(false);
      setForm({ category: "", surchargeRupees: "", note: "" });
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/delivery/category-rules/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    }
  };

  return (
    <section aria-label="Category handling rules" className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">6. Category handling</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          + New rule
        </Button>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Flat per-order surcharge whenever the shipment contains the
        category. One rule per category; applies on top of any partner.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert tone="error" title="Action failed">
            {error}
          </Alert>
        </div>
      ) : null}
      <div className="mt-3">
        {rules.length === 0 ? (
          <EmptyState title="No category rules" message="All categories ship at standard freight." />
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2">
                <span>
                  <strong>{r.category}</strong> +{" "}
                  <strong>
                    {formatMoney({ amountPaise: r.surchargePaise, currency: "INR" })}
                  </strong>
                  {r.note ? <span className="text-zinc-500"> · {r.note}</span> : null}
                </span>
                {confirming === r.id ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="cursor-pointer rounded p-1.5 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="cursor-pointer rounded p-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                    >
                      Back
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(r.id)}
                    className="cursor-pointer rounded p-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {open ? (
        <Modal open onClose={() => setOpen(false)} title="New category rule" actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={busy}>
              Save rule
            </Button>
          </>
        }>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="catrule-category" className="text-sm font-semibold text-zinc-800">
                Category (must match the product category exactly)
              </label>
              <input
                id="catrule-category"
                list="catrule-categories"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Trolleys"
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-brand-700"
              />
              <datalist id="catrule-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <Input
              label="Surcharge (₹, per order)"
              inputMode="decimal"
              placeholder="e.g. 250.00"
              value={form.surchargeRupees}
              onChange={(e) => setForm((f) => ({ ...f, surchargeRupees: e.target.value }))}
            />
            <Input
              label="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

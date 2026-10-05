"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { formatMoney } from "@/lib/orders/pricing";
import type { AdminPartner, AdminWeightSlab } from "@/lib/admin/delivery";
import type { ApiResponse } from "@/types/api";

const kg = (v: string): string =>
  Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 });

/** Weight bands per partner. Bands are [min, max); blank max = open top. */
export function SlabsSection({
  slabs,
  partners,
}: {
  slabs: AdminWeightSlab[];
  partners: AdminPartner[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    partnerId: partners[0]?.id ?? "",
    minKg: "",
    maxKg: "",
    chargeRupees: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delivery/slabs", {
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
      setForm({ partnerId: partners[0]?.id ?? "", minKg: "", maxKg: "", chargeRupees: "" });
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/delivery/slabs/${id}`, { method: "DELETE" });
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

  const inputCls =
    "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-brand-700";

  return (
    <section aria-label="Weight slabs" className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">5. Weight slabs</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          + New slab
        </Button>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Per-partner freight by shipment weight. A matching band replaces the
        pincode base charge; unknown weight anywhere skips slabs entirely.
        Bands may not overlap per partner.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert tone="error" title="Action failed">
            {error}
          </Alert>
        </div>
      ) : null}
      <div className="mt-3">
        {slabs.length === 0 ? (
          <EmptyState title="No weight slabs" message="Base pincode charges apply to every shipment." />
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {slabs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2">
                <span>
                  <strong>{s.partnerName}</strong>: {kg(s.minKg)}–
                  {s.maxKg === null ? "∞" : kg(s.maxKg)} kg →{" "}
                  <strong>
                    {formatMoney({ amountPaise: s.chargePaise, currency: "INR" })}
                  </strong>
                </span>
                {confirming === s.id ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
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
                    onClick={() => setConfirming(s.id)}
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
        <Modal open onClose={() => setOpen(false)} title="New weight slab" actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={busy}>
              Save slab
            </Button>
          </>
        }>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slab-partner" className="text-sm font-semibold text-zinc-800">
                Partner
              </label>
              <select
                id="slab-partner"
                value={form.partnerId}
                onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
                className={inputCls}
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Min weight kg"
              inputMode="decimal"
              placeholder="e.g. 10"
              value={form.minKg}
              onChange={(e) => setForm((f) => ({ ...f, minKg: e.target.value }))}
            />
            <Input
              label="Max weight kg (blank = open)"
              inputMode="decimal"
              placeholder="e.g. 25"
              value={form.maxKg}
              onChange={(e) => setForm((f) => ({ ...f, maxKg: e.target.value }))}
            />
            <Input
              label="Charge (₹)"
              inputMode="decimal"
              placeholder="e.g. 850.00"
              value={form.chargeRupees}
              onChange={(e) => setForm((f) => ({ ...f, chargeRupees: e.target.value }))}
            />
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INDIAN_STATES } from "@/lib/tax/india";
import type { ApiResponse } from "@/types/api";

export interface CustomerBillingInitial {
  name: string;
  addressLine: string;
  city: string;
  stateCode: string;
  pincode: string;
}

/**
 * Current-profile editor. Saves contact info, GSTIN and the reusable
 * billing master — historical order snapshots are separate rows and
 * never change. Blank billing clears the master profile.
 */
export function CustomerForm({
  customerId,
  initial,
}: {
  customerId: string;
  initial: {
    name: string;
    phone: string;
    email: string;
    gstin: string;
    billing: CustomerBillingInitial;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const setBilling = (field: keyof CustomerBillingInitial, value: string) => {
    setForm((f) => ({ ...f, billing: { ...f.billing, [field]: value } }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      {error ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" title="Saved">
          Profile updated. Historical orders are untouched.
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Phone"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Input
          label="Email (optional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="GSTIN (optional)"
          value={form.gstin}
          onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
          hint="Customer-provided. Not government-verified."
        />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <legend className="px-1 text-sm font-bold text-zinc-800">
          Billing master (optional)
        </legend>
        <p className="-mt-1 text-xs text-zinc-500">
          Reused for future GST invoices. Leave blank to clear. Past orders
          keep their own frozen snapshots.
        </p>
        <Input
          label="Legal / business name"
          value={form.billing.name}
          onChange={(e) => setBilling("name", e.target.value)}
        />
        <Input
          label="Billing street address"
          value={form.billing.addressLine}
          onChange={(e) => setBilling("addressLine", e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="City"
            value={form.billing.city}
            onChange={(e) => setBilling("city", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`billing-state-${customerId}`}
              className="text-sm font-semibold text-zinc-800"
            >
              State
            </label>
            <select
              id={`billing-state-${customerId}`}
              value={form.billing.stateCode}
              onChange={(e) => setBilling("stateCode", e.target.value)}
              className="h-11 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-brand-700"
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Billing pincode"
            inputMode="numeric"
            value={form.billing.pincode}
            onChange={(e) => setBilling("pincode", e.target.value)}
          />
        </div>
      </fieldset>
      <div>
        <Button type="submit" loading={busy}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AdminPartner, AdminRateRow } from "@/lib/admin/delivery";
import type { ApiResponse } from "@/types/api";

export interface RateDraft {
  pincode: string;
  partnerId: string;
  serviceable: boolean;
  chargeRupees: string;
  remoteSurchargeRupees: string;
  minOrderRupees: string;
  maxOrderRupees: string;
  etaMinDays: string;
  etaMaxDays: string;
}

const EMPTY_DRAFT: RateDraft = {
  pincode: "",
  partnerId: "",
  serviceable: true,
  chargeRupees: "",
  remoteSurchargeRupees: "",
  minOrderRupees: "",
  maxOrderRupees: "",
  etaMinDays: "",
  etaMaxDays: "",
};

/** Create/edit rate dialog. Same (pincode, partner) twice updates in place. */
const rupees = (paise: number): string => (paise / 100).toFixed(2);

export function RateDialog({
  partners,
  initial,
  onClose,
}: {
  partners: AdminPartner[];
  initial: AdminRateRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<RateDraft>(
    initial
      ? {
          pincode: initial.pincode,
          partnerId: initial.partnerId,
          serviceable: initial.serviceable,
          chargeRupees: rupees(initial.chargePaise),
          remoteSurchargeRupees:
            initial.remoteSurchargePaise === 0 ? "" : rupees(initial.remoteSurchargePaise),
          minOrderRupees:
            initial.minOrderPaise === null ? "" : rupees(initial.minOrderPaise),
          maxOrderRupees:
            initial.maxOrderPaise === null ? "" : rupees(initial.maxOrderPaise),
          etaMinDays: initial.etaMinDays === null ? "" : String(initial.etaMinDays),
          etaMaxDays: initial.etaMaxDays === null ? "" : String(initial.etaMaxDays),
        }
      : { ...EMPTY_DRAFT, partnerId: partners[0]?.id ?? "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof RateDraft, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delivery/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as ApiResponse<{ created: boolean }>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-brand-700";

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit rate ${initial.pincode}` : "New pincode rate"}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={busy}>
            Save rate
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          value={form.pincode}
          onChange={(e) => set("pincode", e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rate-partner" className="text-sm font-semibold text-zinc-800">
            Partner
          </label>
          <select
            id="rate-partner"
            value={form.partnerId}
            onChange={(e) => set("partnerId", e.target.value)}
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
          label="Charge (₹)"
          inputMode="decimal"
          placeholder="e.g. 450.00"
          value={form.chargeRupees}
          onChange={(e) => set("chargeRupees", e.target.value)}
        />
        <Input
          label="Remote surcharge ₹ (optional)"
          inputMode="decimal"
          placeholder="e.g. 120.00"
          value={form.remoteSurchargeRupees}
          onChange={(e) => set("remoteSurchargeRupees", e.target.value)}
          hint="Added on top, shown as its own line at checkout."
        />
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 text-sm font-semibold text-zinc-800">
          <input
            type="checkbox"
            checked={form.serviceable}
            onChange={(e) => set("serviceable", e.target.checked)}
            className="h-4 w-4 accent-brand-800"
          />
          Serviceable
        </label>
        <Input
          label="Min order ₹ (optional)"
          inputMode="decimal"
          value={form.minOrderRupees}
          onChange={(e) => set("minOrderRupees", e.target.value)}
        />
        <Input
          label="Max order ₹ (optional)"
          inputMode="decimal"
          value={form.maxOrderRupees}
          onChange={(e) => set("maxOrderRupees", e.target.value)}
        />
        <Input
          label="ETA min days (optional)"
          type="number"
          min={0}
          max={60}
          value={form.etaMinDays}
          onChange={(e) => set("etaMinDays", e.target.value)}
        />
        <Input
          label="ETA max days (optional)"
          type="number"
          min={0}
          max={60}
          value={form.etaMaxDays}
          onChange={(e) => set("etaMaxDays", e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Delete-rate button with confirmation (orders keep snapshots). */
export function RateDeleteButton({ rateId, label }: { rateId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/delivery/rates/${rateId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete rate ${label}`}
        className="cursor-pointer rounded p-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Delete this rate?"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Back
            </Button>
            <Button size="sm" variant="danger" onClick={run} loading={busy}>
              Delete
            </Button>
          </>
        }
      >
        {error ? (
          <Alert tone="error" title="Action failed">
            {error}
          </Alert>
        ) : null}
        <p>
          Rate <strong>{label}</strong> will stop being offered. Existing
          orders keep their stored charge and partner.
        </p>
      </Modal>
    </>
  );
}

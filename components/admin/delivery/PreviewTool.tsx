"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatMoney } from "@/lib/orders/pricing";
import type { ApiResponse } from "@/types/api";

interface PreviewResult {
  serviceable: boolean;
  pincode: string;
  partner: { id: string; name: string } | null;
  deliveryChargePaise: number | null;
  etaDays?: { min: number; max: number };
  options: Array<{ partner: { id: string; name: string }; deliveryChargePaise: number }>;
  reason?: string;
}

/**
 * Admin pincode preview. Posts to the exact public endpoint customers
 * hit, so what the admin sees is what checkout computes — one engine,
 * verified in one place.
 */
export function PreviewTool() {
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: pincode.trim() }),
      });
      const json = (await res.json()) as ApiResponse<PreviewResult>;
      if (!json.ok) {
        setError(json.error.message);
        setResult(null);
        return;
      }
      setResult(json.data);
    } catch {
      setError("Could not reach the server. Please try again.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="w-40">
          <Input
            label="Pincode"
            inputMode="numeric"
            maxLength={6}
            placeholder="302001"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
          />
        </div>
        <Button type="submit" loading={busy}>
          Check Pincode
        </Button>
      </form>
      {error ? (
        <Alert tone="error" title="Check failed">
          {error}
        </Alert>
      ) : null}
      <div aria-live="polite">
        {result && result.serviceable && result.partner ? (
          <Alert tone="success" title="Delivery available">
            <p>
              Selected: <strong>{result.partner.name}</strong> ·{" "}
              <strong>
                {formatMoney({ amountPaise: result.deliveryChargePaise ?? 0, currency: "INR" })}
              </strong>
              {result.etaDays ? ` · ETA ${result.etaDays.min}–${result.etaDays.max} days` : null}
            </p>
            {result.options.length > 1 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {result.options.map((o) => (
                  <li key={o.partner.id} className="flex justify-between gap-2 text-sm">
                    <span>{o.partner.name}</span>
                    <PriceDisplay amountPaise={o.deliveryChargePaise} size="sm" />
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {result && !result.serviceable ? (
          <Alert tone="warning" title="Not serviceable">
            {result.reason ?? `No delivery partner serves ${result.pincode}.`}
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

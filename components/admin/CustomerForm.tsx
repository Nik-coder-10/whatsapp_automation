"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/types/api";

/**
 * Current-profile editor. Saves name/phone/email/GSTIN only —
 * historical order snapshots are separate rows and never change.
 */
export function CustomerForm({
  customerId,
  initial,
}: {
  customerId: string;
  initial: { name: string; phone: string; email: string; gstin: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <div>
        <Button type="submit" loading={busy}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

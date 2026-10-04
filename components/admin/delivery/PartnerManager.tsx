"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AdminPartner } from "@/lib/admin/delivery";
import type { ApiResponse } from "@/types/api";

/** Create/edit partner dialog (name, contact, priority, active flag). */
export function PartnerDialog({
  partner,
  onClose,
}: {
  partner: AdminPartner | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(partner?.name ?? "");
  const [contactName, setContactName] = useState(partner?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(partner?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(partner?.contactEmail ?? "");
  const [priority, setPriority] = useState(String(partner?.priority ?? 100));
  const [isActive, setIsActive] = useState(partner?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        partner ? `/api/admin/delivery/partners/${partner.id}` : "/api/admin/delivery/partners",
        {
          method: partner ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            contactName,
            contactPhone,
            contactEmail,
            priority: Number(priority),
            isActive,
          }),
        },
      );
      const json = (await res.json()) as ApiResponse<unknown>;
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

  return (
    <Modal
      open
      onClose={onClose}
      title={partner ? `Edit ${partner.name}` : "New delivery partner"}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={busy}>
            Save partner
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Contact person (optional)"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contact phone (optional)"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Input
            label="Priority (lower wins)"
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>
        <Input
          label="Contact email (optional)"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-800">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-brand-800"
          />
          Active
        </label>
      </div>
    </Modal>
  );
}

/** One-click activate/deactivate with confirmation. */
export function PartnerToggle({
  partner,
}: {
  partner: Pick<AdminPartner, "id" | "name" | "isActive">;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/delivery/partners/${partner.id}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !partner.isActive }),
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
      {error ? (
        <Alert tone="error" title="Action failed">
          {error}
        </Alert>
      ) : null}
      <Button
        size="sm"
        variant={partner.isActive ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {partner.isActive ? "Deactivate" : "Activate"}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={partner.isActive ? "Deactivate partner?" : "Activate partner?"}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Back
            </Button>
            <Button size="sm" onClick={run} loading={busy}>
              Confirm
            </Button>
          </>
        }
      >
        <p>
          {partner.isActive ? (
            <>
              <strong>{partner.name}</strong> stops being offered for new
              pincodes immediately. Existing orders keep their snapshots.
            </>
          ) : (
            <>
              <strong>{partner.name}</strong> becomes offerable again wherever
              serviceable rows exist.
            </>
          )}
        </p>
      </Modal>
    </>
  );
}

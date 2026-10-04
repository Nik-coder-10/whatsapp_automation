"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/types/api";

/**
 * Activate/deactivate toggle with confirmation. Deactivation hides the
 * product from the catalogue but preserves every historical order
 * (snapshots + RESTRICT) — never a delete.
 */
export function ActiveToggle({
  productId,
  productName,
  isActive,
}: {
  productId: string;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
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
    <div className="flex flex-col gap-2">
      {error ? (
        <Alert tone="error" title="Action failed">
          {error}
        </Alert>
      ) : null}
      <div>
        <Button size="sm" variant={isActive ? "danger" : "primary"} onClick={() => setOpen(true)}>
          {isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={isActive ? "Deactivate this product?" : "Reactivate this product?"}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Back
            </Button>
            <Button
              size="sm"
              variant={isActive ? "danger" : "primary"}
              onClick={run}
              loading={busy}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p>
          {isActive ? (
            <>
              <strong>{productName}</strong> will disappear from the customer
              catalogue and cannot be added to new carts or orders. Past
              orders keep their snapshots untouched.
            </>
          ) : (
            <>
              <strong>{productName}</strong> will become visible and
              purchasable in the customer catalogue again.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}

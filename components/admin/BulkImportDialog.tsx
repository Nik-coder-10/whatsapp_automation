"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/types/api";
import type { ImportDataset } from "@/lib/admin/importer";

interface Preview {
  dataset: string;
  total: number;
  valid: number;
  creates: number;
  updates: number;
  skipped: number;
  invalid: Array<{ line: number; message: string }>;
  invalidTotal: number;
}

interface Result extends Preview {
  inserted: number;
  updated: number;
}

/**
 * Two-step bulk import (preview → confirm) for whitelisted datasets.
 * Preview writes nothing; Confirm re-validates server-side and applies
 * atomically. Invalid files never reach Confirm.
 */
export function BulkImportDialog({
  dataset,
  title,
  columnsHelp,
  sampleCsv,
  sampleName,
}: {
  dataset: ImportDataset;
  title: string;
  columnsHelp: string;
  sampleCsv: string;
  sampleName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sampleName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readFile = async (): Promise<string | null> => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return null;
    }
    return file.text();
  };

  const runPreview = async () => {
    const csv = await readFile();
    if (csv === null) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dataset, csv }),
      });
      const json = (await res.json()) as ApiResponse<Preview>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setPreview(json.data);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    const csv = await readFile();
    if (csv === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dataset, csv }),
      });
      const json = (await res.json()) as ApiResponse<Result>;
      if (!json.ok) {
        setError(json.error.message);
        // Refresh the preview so newly-surfaced errors are visible.
        await runPreview();
        return;
      }
      setResult(json.data);
      setPreview(null);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600">
        Columns:{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
          {columnsHelp}
        </code>
        . {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`bulk-csv-${dataset}`} className="sr-only">
          CSV file
        </label>
        <input
          ref={fileRef}
          id={`bulk-csv-${dataset}`}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-zinc-700 file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-4 file:text-sm file:font-semibold file:text-zinc-800 hover:file:bg-zinc-50"
        />
        <Button size="sm" onClick={runPreview} loading={busy}>
          Preview
        </Button>
        <button
          type="button"
          onClick={downloadSample}
          className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline"
        >
          Download sample CSV
        </button>
      </div>
      {error ? (
        <Alert tone="error" title="Import failed">
          {error}
        </Alert>
      ) : null}
      {preview ? (
        <div aria-live="polite" className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p className="font-bold text-zinc-900">
            {preview.total} rows: {preview.valid} valid ({preview.creates} new,{" "}
            {preview.updates} updates)
            {preview.invalidTotal > 0 ? `, ${preview.invalidTotal} invalid` : ""}
          </p>
          {preview.invalid.length > 0 ? (
            <>
              <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                {preview.invalid.map((e, i) => (
                  <li key={i} className="text-xs text-red-700">
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold text-red-700">
                Fix the invalid rows first — Confirm is disabled until the
                file is clean.
              </p>
            </>
          ) : (
            <div className="mt-3">
              <Button size="sm" onClick={runConfirm} loading={busy}>
                Confirm import ({preview.valid} rows)
              </Button>
              <p className="mt-1 text-xs text-zinc-500">
                Applies atomically: any failure rolls everything back.
              </p>
            </div>
          )}
        </div>
      ) : null}
      {result ? (
        <div aria-live="polite" className="rounded-md border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-900">
            Imported {result.total} rows: {result.inserted} inserted,{" "}
            {result.updated} updated.
          </p>
        </div>
      ) : null}
    </div>
  );
}

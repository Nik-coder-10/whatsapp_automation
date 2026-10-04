"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/types/api";

interface ImportSummary {
  total: number;
  valid: number;
  invalid: Array<{ line: number; message: string }>;
  inserted: number;
  updated: number;
  skipped: number;
}

const SAMPLE_CSV = `pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max
400001,Delhivery,450.00,true,,,2,4
400001,XpressBees,520.00,true,,,2,5`;

/**
 * CSV bulk import: file → server validation of EVERY row → atomic-ish
 * apply with a full summary. Invalid files commit nothing; every
 * skipped row is reported with its line number.
 */
export function ImportTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rates-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/admin/delivery/rates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = (await res.json()) as ApiResponse<ImportSummary>;
      if (!json.ok) {
        setError(json.error.message);
        return;
      }
      setSummary(json.data);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600">
        Columns: <code className="rounded bg-zinc-100 px-1 font-mono text-xs">pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max</code>.
        Partner matches by name. Same pair twice updates in place.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="rates-csv" className="sr-only">
          CSV file with pincode rates
        </label>
        <input
          ref={fileRef}
          id="rates-csv"
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-zinc-700 file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-4 file:text-sm file:font-semibold file:text-zinc-800 hover:file:bg-zinc-50"
        />
        <Button size="sm" onClick={run} loading={busy}>
          Validate & import
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
      {summary ? (
        <div aria-live="polite" className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p className="font-bold text-zinc-900">
            {summary.total} rows: {summary.inserted} inserted, {summary.updated} updated,{" "}
            {summary.skipped} skipped
          </p>
          {summary.invalid.length > 0 ? (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {summary.invalid.map((e, i) => (
                <li key={i} className="text-xs text-red-700">
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-green-800">All rows valid — file fully applied.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "warning" | "error";

const tones: Record<AlertTone, string> = {
  info: "border-brand-300 bg-brand-50 text-brand-900",
  success: "border-green-300 bg-green-50 text-green-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
};

const titles: Record<AlertTone, string> = {
  info: "Note",
  success: "Success",
  warning: "Please note",
  error: "Something needs attention",
};

/** Static (non-dismissible) message banner. Uses role="alert" for errors. */
export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border-l-4 px-4 py-3 text-sm ${tones[tone]}`}
    >
      <p className="font-semibold">{title ?? titles[tone]}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

import type { Metadata } from "next";
import { AdminShell } from "@/components/layout/admin/AdminShell";
import { PartnersSection } from "@/components/admin/delivery/PartnersSection";
import { RatesSection } from "@/components/admin/delivery/RatesSection";
import { PreviewTool } from "@/components/admin/delivery/PreviewTool";
import { ImportTool } from "@/components/admin/delivery/ImportTool";
import {
  listDeliveryPartners,
  listDeliveryRates,
  parseAdminRateQuery,
} from "@/lib/admin/delivery";

export const metadata: Metadata = {
  title: "Delivery",
  robots: { index: false, follow: false },
};

/**
 * Delivery management: partners, pincode rates (filterable + CSV
 * import), live serviceability preview (same engine as checkout),
 * and the documented selection strategy.
 */
export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAdminRateQuery(await searchParams);
  let partners = null;
  let rates = null;
  try {
    [partners, rates] = await Promise.all([
      listDeliveryPartners(),
      listDeliveryRates(query),
    ]);
  } catch {
    partners = null;
    rates = null;
  }

  return (
    <AdminShell title="Delivery" subtitle="Partners, pincode rates and serviceability">
      {!partners || !rates ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-5">
          <p className="font-bold text-red-800">Couldn&apos;t load delivery data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PartnersSection partners={partners} />
          <RatesSection
            view={{
              rates: rates.rates,
              total: rates.total,
              page: rates.page,
              totalPages: rates.totalPages,
              base: {
                ...(query.q ? { q: query.q } : {}),
                ...(query.partnerId ? { partner: query.partnerId } : {}),
                ...(query.serviceable !== undefined
                  ? { serviceable: query.serviceable ? "true" : "false" }
                  : {}),
              },
            }}
            partners={partners}
            filters={{
              ...(query.q ? { q: query.q } : {}),
              ...(query.partnerId ? { partnerId: query.partnerId } : {}),
              ...(query.serviceable !== undefined
                ? { serviceable: query.serviceable }
                : {}),
            }}
          />

          <section aria-label="Serviceability preview" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">3. Serviceability preview</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Runs the exact checkout engine — what you see here is what
              customers get.
            </p>
            <div className="mt-3">
              <PreviewTool />
            </div>
          </section>

          <section aria-label="Configuration and priority" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">4. Configuration &amp; priority</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-zinc-700">
              <li>Only active partners with serviceable rows qualify.</li>
              <li>Lowest partner priority number wins (edit it per partner above).</li>
              <li>Ties break on the lowest delivery charge.</li>
              <li>Min/max order windows apply when an order subtotal is known.</li>
            </ol>
            <p className="mt-2 text-sm text-zinc-600">
              Changing rates never touches historical orders — they keep
              their stored partner and charge.
            </p>
          </section>

          <section aria-label="Bulk import" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">5. Bulk CSV import</h2>
            <div className="mt-3">
              <ImportTool />
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

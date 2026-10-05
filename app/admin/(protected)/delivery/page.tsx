import type { Metadata } from "next";
import { AdminShell } from "@/components/layout/admin/AdminShell";
import { PartnersSection } from "@/components/admin/delivery/PartnersSection";
import { RatesSection } from "@/components/admin/delivery/RatesSection";
import { SlabsSection } from "@/components/admin/delivery/SlabsSection";
import { CategoryRulesSection } from "@/components/admin/delivery/CategoryRulesSection";
import { PreviewTool } from "@/components/admin/delivery/PreviewTool";
import { BulkImportDialog } from "@/components/admin/BulkImportDialog";
import {
  listCategoryRules,
  listDeliveryPartners,
  listDeliveryProducts,
  listDeliveryRates,
  listWeightSlabs,
  parseAdminRateQuery,
} from "@/lib/admin/delivery";
import { listAdminCategories } from "@/lib/admin/products";

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
  let slabs = null;
  let categoryRules = null;
  let previewProducts: Array<{ id: string; name: string }> = [];
  let categories: string[] = [];
  try {
    [partners, rates, slabs, categoryRules, previewProducts, categories] =
      await Promise.all([
        listDeliveryPartners(),
        listDeliveryRates(query),
        listWeightSlabs(),
        listCategoryRules(),
        listDeliveryProducts(),
        listAdminCategories(),
      ]);
  } catch {
    partners = null;
    rates = null;
    slabs = null;
    categoryRules = null;
  }

  return (
    <AdminShell title="Delivery" subtitle="Partners, pincode rates and serviceability">
      {!partners || !rates || !slabs || !categoryRules ? (
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

          <SlabsSection slabs={slabs} partners={partners} />

          <CategoryRulesSection rules={categoryRules} categories={categories} />

          <section aria-label="Serviceability preview" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">7. Serviceability preview</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Runs the exact checkout engine — what you see here is what
              customers get. Add cart lines to test weight, value and
              category rules; the breakdown names the winning rule.
            </p>
            <div className="mt-3">
              <PreviewTool products={previewProducts} />
            </div>
          </section>

          <section aria-label="Configuration and priority" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">8. Configuration &amp; priority</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-zinc-700">
              <li>Only active partners with serviceable rows qualify.</li>
              <li>Category handling surcharges apply per order, on any partner.</li>
              <li>A matching weight band replaces the pincode base charge for that partner.</li>
              <li>Lowest partner priority number wins (edit it per partner above).</li>
              <li>Ties break on the lowest partner total (freight + remote surcharge).</li>
              <li>Min/max order windows apply when an order subtotal is known.</li>
            </ol>
            <p className="mt-2 text-sm text-zinc-600">
              Changing rates never touches historical orders — they keep
              their stored partner, charge, weight and rule summary.
            </p>
          </section>

          <section aria-label="Bulk import and export" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">9. Bulk CSV import &amp; export</h2>
            <div className="mt-3">
              <BulkImportDialog
                dataset="rates"
                title="Partner matches by name. Same (pincode, partner) twice updates in place."
                columnsHelp="pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max"
                sampleCsv={`pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max
400001,Delhivery,450.00,true,,,2,4
400001,XpressBees,520.00,true,,,2,5`}
                sampleName="rates-sample.csv"
              />
              <p className="mt-3 text-sm">
                <a
                  href="/api/admin/export/rates"
                  download
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Export all rates (CSV)
                </a>
                <span className="text-zinc-500"> — same columns as import.</span>
              </p>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

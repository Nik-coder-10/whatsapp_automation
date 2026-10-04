import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin/AdminShell";
import { EmptyState } from "@/components/ui/States";
import {
  listAdminCustomers,
  parseAdminCustomerQuery,
} from "@/lib/admin/customers";
import { formatMoney } from "@/lib/orders/pricing";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

/** Paginated customer list with repeat-buyer signals (server-rendered). */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAdminCustomerQuery(await searchParams);
  let result = null;
  try {
    result = await listAdminCustomers(query);
  } catch {
    result = null;
  }

  return (
    <AdminShell title="Customers" subtitle="Repeat buyers, value and history">
      <form
        method="get"
        action="/admin/customers"
        aria-label="Search and sort customers"
        className="rounded-lg border border-zinc-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-semibold text-zinc-800">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              placeholder="Name, phone, email, GSTIN…"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-700"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sort" className="text-sm font-semibold text-zinc-800">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={query.sort}
              className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-brand-700"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="orders_desc">Most orders</option>
              <option value="paid_desc">Highest paid value</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 cursor-pointer items-center rounded-md bg-brand-800 px-4 text-sm font-bold text-white hover:bg-brand-700"
            >
              Apply
            </button>
            <Link
              href="/admin/customers"
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Clear
            </Link>
          </div>
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        {!result ? (
          <div role="alert">
            <p className="font-bold text-red-800">Couldn&apos;t load customers.</p>
          </div>
        ) : result.customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            message="Try different search terms or clear the search."
          />
        ) : (
          <>
            <p role="status" className="mb-3 text-sm text-zinc-600">
              {result.total} {result.total === 1 ? "customer" : "customers"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 uppercase">
                    <th scope="col" className="py-2 pr-3 font-bold">Customer</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Contact</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Orders</th>
                    <th scope="col" className="py-2 pr-3 font-bold">Paid value</th>
                    <th scope="col" className="py-2 font-bold">Latest order</th>
                  </tr>
                </thead>
                <tbody>
                  {result.customers.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/customers/${c.id}`} className="font-bold text-zinc-900 hover:text-brand-700 hover:underline">
                          {c.name}
                        </Link>
                        {c.orderCount > 1 ? (
                          <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-800">
                            Repeat ×{c.orderCount}
                          </span>
                        ) : null}
                        {c.gstin ? (
                          <span className="block font-mono text-xs text-zinc-500">{c.gstin}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-700">
                        {c.phone}
                        <span className="block text-xs text-zinc-500">{c.email ?? "—"}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-700">
                        {c.orderCount} <span className="text-zinc-400">({c.paidCount} paid)</span>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold whitespace-nowrap text-zinc-900">
                        {formatMoney({ amountPaise: c.paidTotalPaise, currency: "INR" })}
                      </td>
                      <td className="py-2.5 text-xs whitespace-nowrap text-zinc-500">
                        {c.latestOrderAt
                          ? new Date(c.latestOrderAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.totalPages > 1 ? (
              <nav aria-label="Customer pages" className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {result.page > 1 ? (
                  <Link
                    href={`/admin/customers?q=${encodeURIComponent(query.q ?? "")}&sort=${query.sort}&page=${result.page - 1}`}
                    className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span aria-disabled="true" className="inline-flex h-10 cursor-not-allowed items-center rounded-md border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-400">
                    ← Previous
                  </span>
                )}
                <p className="text-sm text-zinc-600">
                  Page {result.page} of {result.totalPages}
                </p>
                {result.page < result.totalPages ? (
                  <Link
                    href={`/admin/customers?q=${encodeURIComponent(query.q ?? "")}&sort=${query.sort}&page=${result.page + 1}`}
                    className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    Next →
                  </Link>
                ) : (
                  <span aria-disabled="true" className="inline-flex h-10 cursor-not-allowed items-center rounded-md border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-400">
                    Next →
                  </span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </AdminShell>
  );
}

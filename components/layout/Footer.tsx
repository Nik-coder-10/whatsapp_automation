import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * Public footer: brand + catalogue + company + buying-info columns,
 * collapsing to one column on mobile. No hard-coded contact details —
 * buying flows route through the contact section.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-950 text-brand-100">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-white">
            TROLIFT <span className="text-amber-400">Solutions</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-brand-200">
            Industrial material-handling equipment for Indian warehouses,
            plants and workshops — with GST invoicing and pan-India
            delivery.
          </p>
        </div>
        <nav aria-label="Products">
          <p className="text-sm font-bold tracking-wide text-white uppercase">Equipment</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(
              [
                ["Pallet Handling", "/#categories"],
                ["Lifting & Stacking", "/#categories"],
                ["Platform Trolleys", "/#categories"],
                ["Dock Equipment", "/#categories"],
              ] as [string, string][]
            ).map(([label, href]) => (
              <li key={label}>
                <Link href={href} className="text-brand-200 hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-sm font-bold tracking-wide text-white uppercase">Company</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(
              [
                ["Featured products", "/#featured"],
                ["Why Trolift", "/#trust"],
                ["Contact sales", "/#contact"],
                ["API health", "/api/health"],
              ] as [string, string][]
            ).map(([label, href]) => (
              <li key={label}>
                <Link href={href} className="text-brand-200 hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-bold tracking-wide text-white uppercase">Buying info</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-brand-200">
            <li>GST invoice on every order</li>
            <li>Volume pricing on request</li>
            <li>Delivery across India by pincode</li>
            <li>
              <Link href="/#contact" className="font-semibold text-amber-400 hover:text-amber-300 hover:underline">
                Request a callback →
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <p>B2B material-handling equipment — {siteConfig.tagline}</p>
        </div>
      </div>
    </footer>
  );
}

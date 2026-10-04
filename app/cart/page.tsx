import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review your Trolift equipment shortlist before checkout.",
  robots: { index: false, follow: false },
};

/** Cart route shell (items render client-side from localStorage). */
export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link href="/" className="text-brand-700 underline-offset-2 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden className="text-zinc-400">
            /
          </li>
          <li>
            <span aria-current="page" className="text-zinc-500">
              Cart
            </span>
          </li>
        </ol>
      </nav>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
        Shopping Cart
      </h1>
      <div className="mt-5">
        <CartView />
      </div>
    </div>
  );
}

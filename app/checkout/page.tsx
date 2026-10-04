import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Enter your details and delivery pincode to review your Trolift order.",
  robots: { index: false, follow: false },
};

/** Checkout shell: the form renders client-side (cart lives in the browser). */
export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
        Checkout
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600">
        Share your details and delivery pincode. Totals shown here are
        informational — the server confirms everything when you place the
        order.{" "}
        <Link href="/cart" className="font-semibold text-brand-700 hover:underline">
          Edit cart
        </Link>
      </p>
      <div className="mt-5">
        <CheckoutForm />
      </div>
    </div>
  );
}

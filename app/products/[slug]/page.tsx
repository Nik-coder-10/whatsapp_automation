import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { StockBadge } from "@/components/ui/StatusBadge";
import { getProductBySlug, getProductSlugs } from "@/lib/catalog/queries";
import { priceToPaise } from "@/lib/catalog/products";
import { getWhatsAppLink } from "@/lib/contact";
import type { Json } from "@/types/database";

function prettifyKey(key: string): string {
  return key.replace(/_/g, " ");
}

/** Top-level spec entries only (nested objects render as JSON). */
function specEntries(specs: Json): Array<[string, string]> {
  if (specs === null || typeof specs !== "object" || Array.isArray(specs)) {
    return [];
  }
  return Object.entries(specs).map(([k, v]) => [
    prettifyKey(k),
    typeof v === "object" ? JSON.stringify(v) : String(v),
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} — price & specs`,
    description: `${product.description} Category: ${product.category}. Ex-GST pricing with GST invoice.`,
  };
}

/**
 * Known slugs are prerendered; unknown slugs 404 at routing level
 * (dynamicParams = false), which is why this returns a proper 404
 * status instead of an embedded not-found boundary.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Read-only product detail (no cart/checkout yet): photo, price, stock,
 * specifications and a WhatsApp enquiry CTA. Inactive/unknown slugs 404.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const image = product.images[0] ?? "/images/products/placeholder.svg";
  const specs = specEntries(product.specifications);
  const enquiry = getWhatsAppLink(
    `Hello Trolift Solutions, I want a quote for "${product.name}".`,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: product.name }]}
      />
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-brand-50">
          <Image
            src={image}
            alt={`${product.name} — product photo coming soon`}
            width={800}
            height={600}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-brand-700 uppercase">
            {product.category}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-2">
            <StockBadge quantity={product.stock_quantity} />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{product.description}</p>
          <div className="mt-4 border-y border-zinc-200 py-4">
            <PriceDisplay
              amountPaise={priceToPaise(product.price)}
              unitNote="excl. GST · GST invoice included"
              size="lg"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Final freight is confirmed against your delivery pincode before payment.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {enquiry ? (
              <a
                href={enquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-green-600 px-6 text-base font-bold text-white hover:bg-green-500"
              >
                Enquire on WhatsApp
              </a>
            ) : (
              <Link
                href="/#contact"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-brand-800 px-6 text-base font-bold text-white hover:bg-brand-700"
              >
                Contact sales
              </Link>
            )}
            <button
              type="button"
              disabled
              title="Add to cart — coming with the cart phase"
              className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-6 text-base font-bold text-zinc-400"
            >
              Add to Cart — soon
            </button>
          </div>
        </div>
      </div>
      {specs.length > 0 ? (
        <section aria-labelledby="specs-heading" className="mt-10">
          <h2 id="specs-heading" className="text-xl font-extrabold tracking-tight text-zinc-900">
            Specifications
          </h2>
          <dl className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {specs.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[140px_1fr] gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[220px_1fr]"
              >
                <dt className="font-semibold text-zinc-500 capitalize">{k}</dt>
                <dd className="font-medium text-zinc-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

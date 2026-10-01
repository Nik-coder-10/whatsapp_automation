import { getWhatsAppLink } from "@/lib/contact";

/**
 * Contact / WhatsApp CTA band. The WhatsApp button is enabled only when
 * NEXT_PUBLIC_WHATSAPP_NUMBER is configured — otherwise a fallback note
 * is shown and nothing is hard-coded.
 */
export function ContactCTA() {
  const waLink = getWhatsAppLink(
    "Hello Trolift Solutions, I want a quote for material-handling equipment.",
  );

  return (
    <section aria-labelledby="contact-heading" id="contact" className="scroll-mt-20 rounded-lg bg-brand-800 p-6 text-white sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-amber-400 uppercase">Contact sales</p>
          <h2 id="contact-heading" className="mt-1 text-2xl font-extrabold tracking-tight">
            Get a quote in one message
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brand-100">
            Tell us the equipment, quantity and delivery pincode — add your
            GSTIN if you need a GST invoice. We reply with price, freight
            and delivery time.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-md bg-amber-400 px-6 text-base font-bold text-brand-950 hover:bg-amber-300"
            >
              Chat on WhatsApp
            </a>
          ) : (
            <p className="rounded-md border border-brand-600 bg-brand-900 px-4 py-3 text-sm text-brand-100">
              WhatsApp sales line is being set up — the online catalogue
              with instant quotes launches next.
            </p>
          )}
          <a
            href="#featured"
            className="inline-flex h-12 items-center justify-center rounded-md border border-brand-500 px-6 text-base font-bold text-white hover:bg-brand-700"
          >
            Review featured products
          </a>
        </div>
      </div>
    </section>
  );
}

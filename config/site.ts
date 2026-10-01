export const siteConfig = {
  name: "Trolift Solutions",
  tagline: "B2B material-handling equipment, ordered simply.",
  description:
    "Trolift Solutions — B2B material-handling equipment with transparent pricing, GST invoicing and pan-India delivery.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;

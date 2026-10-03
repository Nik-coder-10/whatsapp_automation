"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { getWhatsAppLink } from "@/lib/contact";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "Why Trolift", href: "/#trust" },
  { label: "Contact", href: "/#contact" },
] as const;

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5" aria-label={siteConfig.name}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="shrink-0">
        <rect width="34" height="34" rx="6" fill="#1e344d" />
        <g stroke="#f5a301" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 24 V12 h9 l4 5 v7" />
          <circle cx="12" cy="25" r="2.2" fill="#f5a301" stroke="none" />
          <circle cx="23" cy="25" r="2.2" fill="#f5a301" stroke="none" />
        </g>
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-white">TROLIFT</span>
        <span className="text-[10px] font-semibold tracking-[0.18em] text-amber-400 uppercase">
          Solutions
        </span>
      </span>
    </span>
  );
}

/** Quote CTA: WhatsApp deep link when configured, contact section otherwise. */
function QuoteCta({ mobile = false }: { mobile?: boolean }) {
  const wa = getWhatsAppLink(
    "Hello Trolift Solutions, I want a quote for material-handling equipment.",
  );
  const cls = mobile
    ? "flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold"
    : "inline-flex h-10 items-center rounded-md px-4 text-sm font-bold";
  if (wa) {
    return (
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} bg-green-600 text-white hover:bg-green-500`}
      >
        WhatsApp Us
      </a>
    );
  }
  return (
    <Link href="/#contact" className={`${cls} bg-amber-400 text-brand-950 hover:bg-amber-300`}>
      Get a Quote
    </Link>
  );
}

/**
 * Public storefront navbar: sticky, keyboard-friendly mobile menu,
 * disabled cart placeholder (cart phase wires it up).
 */
export function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <header className="sticky top-0 z-40 bg-brand-900 text-white shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${siteConfig.name} — home`}>
          <BrandMark />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            disabled
            title="Shopping cart — coming with the cart phase"
            aria-label="Shopping cart, coming soon"
            className="cursor-not-allowed rounded p-2 text-brand-200 opacity-60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="17" cy="20" r="1.6" />
              <path d="M2 3h3l2.6 12.5a1 1 0 001 .5h8.7a1 1 0 001-.8L20 7H6" />
            </svg>
          </button>
          <QuoteCta />
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            disabled
            title="Shopping cart — coming with the cart phase"
            aria-label="Shopping cart, coming soon"
            className="cursor-not-allowed rounded p-2 text-brand-200 opacity-60"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="17" cy="20" r="1.6" />
              <path d="M2 3h3l2.6 12.5a1 1 0 001 .5h8.7a1 1 0 001-.8L20 7H6" />
            </svg>
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="cursor-pointer rounded p-2 hover:bg-brand-800"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              {open ? (
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-brand-800 px-4 pt-2 pb-4 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-2.5 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2" onClick={() => setOpen(false)}>
              <QuoteCta mobile />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

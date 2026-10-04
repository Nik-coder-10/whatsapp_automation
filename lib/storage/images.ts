/**
 * Product image handling.
 *
 * There is no storage bucket yet: `products.images` holds display paths
 * (local `/images/…` or https URLs). This module is the single place
 * that validates and resolves them, so a future Supabase Storage
 * integration only changes code here:
 *   - uploads go through a signed-URL flow (never an open file POST),
 *   - `resolveProductImage()` gains bucket-URL resolution.
 */

export const PRODUCT_IMAGE_PLACEHOLDER = "/images/products/placeholder.svg";
export const MAX_PRODUCT_IMAGES = 10;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".avif"];

/** Safe display path: site-relative /images path or https URL. */
export function isValidImageSrc(value: string): boolean {
  const v = value.trim();
  if (v === "" || v.length > 500) return false;
  const lower = v.toLowerCase();
  if (!IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (lower.startsWith("/images/")) {
    return !lower.includes("..") && !/\s/.test(v);
  }
  try {
    const url = new URL(v);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateImageList(images: string[]): string | null {
  if (images.length > MAX_PRODUCT_IMAGES) {
    return `At most ${MAX_PRODUCT_IMAGES} images per product.`;
  }
  const bad = images.find((src) => !isValidImageSrc(src));
  return bad ? `Invalid image path: ${bad}` : null;
}

/** First image, or the branded placeholder when none is set. */
export function resolveProductImage(images: string[]): string {
  const first = images.find((src) => isValidImageSrc(src));
  return first ?? PRODUCT_IMAGE_PLACEHOLDER;
}

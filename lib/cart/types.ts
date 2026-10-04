/**
 * Cart domain types.
 *
 * The cart is a client-side convenience only. Prices stored here are
 * display snapshots — checkout re-prices everything server-side from
 * trusted product rows and never trusts these values.
 */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  category: string;
  /** Unit-price snapshot in integer paise (display only). */
  pricePaise: number;
  image: string;
  /** Stock at add time — quantities clamp to this. */
  stockQuantity: number;
  quantity: number;
}

export type CartItems = CartItem[];

export interface AddItemInput {
  productId: string;
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  image: string;
  stockQuantity: number;
  quantity: number;
}

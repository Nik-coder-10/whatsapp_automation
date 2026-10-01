/**
 * Catalogue data structures shared by the homepage and (later) the
 * product catalogue. Shapes mirror public.products rows; the static
 * lists below mirror supabase/seed/seed.sql and will be replaced by
 * Supabase queries once a project is linked — ProductCard and friends
 * already consume these types, so no component changes are needed then.
 */
import type { ProductRow } from "@/types/database";

export type CatalogProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "category"
  | "specifications"
  | "price"
  | "stock_quantity"
  | "images"
  | "is_active"
>;

export interface ProductCategory {
  slug: string;
  name: string;
  blurb: string;
  productCount: number;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { slug: "pallet-handling", name: "Pallet Handling", blurb: "Hand pallet trucks and stackers for docks and godowns.", productCount: 2 },
  { slug: "lifting-stacking", name: "Lifting & Stacking", blurb: "Scissor tables, chain blocks and stackers.", productCount: 3 },
  { slug: "trolleys", name: "Platform Trolleys", blurb: "Shop-floor trolleys built for daily abuse.", productCount: 1 },
  { slug: "drum-handling", name: "Drum Handling", blurb: "Safe 210-litre drum movers and handlers.", productCount: 1 },
  { slug: "dock-equipment", name: "Dock Equipment", blurb: "Levelers and dock accessories.", productCount: 1 },
  { slug: "material-movement", name: "Material Movement", blurb: "Tow tractors for large plants.", productCount: 1 },
];

/** Prices are NUMERIC(12,2) decimal strings, exactly as PostgREST returns. */
export const FEATURED_PRODUCTS: CatalogProduct[] = [
  {
    id: "b1c2d3e4-0001-4000-8000-000000000001",
    name: "Hydraulic Hand Pallet Truck 2500 kg",
    slug: "hydraulic-hand-pallet-truck-2500kg",
    description:
      "Heavy-duty hydraulic hand pallet truck for warehouses and loading bays.",
    category: "Pallet Handling",
    specifications: { capacity_kg: 2500, fork_length_mm: 1150 },
    price: "24999.00",
    stock_quantity: 42,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0002-4000-8000-000000000002",
    name: "Electric Pallet Stacker 1500 kg",
    slug: "electric-pallet-stacker-1500kg",
    description:
      "Battery-operated stacker with 3 m lift height for racking and truck loading.",
    category: "Lifting & Stacking",
    specifications: { capacity_kg: 1500, lift_height_m: 3.0 },
    price: "285000.00",
    stock_quantity: 8,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0004-4000-8000-000000000004",
    name: "Heavy-Duty Platform Trolley 500 kg",
    slug: "heavy-duty-platform-trolley-500kg",
    description:
      "Steel-deck platform trolley with foldable handle for shop floors.",
    category: "Trolleys",
    specifications: { capacity_kg: 500 },
    price: "6299.00",
    stock_quantity: 120,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0007-4000-8000-000000000007",
    name: "Hydraulic Dock Leveler 6 Tonne",
    slug: "hydraulic-dock-leveler-6t",
    description:
      "Pit-mounted hydraulic dock leveler bridging dock and truck bed.",
    category: "Dock Equipment",
    specifications: { capacity_t: 6 },
    price: "145000.00",
    stock_quantity: 5,
    images: [],
    is_active: true,
  },
];

/** NUMERIC decimal string → integer paise (≤2dp, so exact). */
export function priceToPaise(price: string): number {
  return Math.round(Number(price) * 100);
}

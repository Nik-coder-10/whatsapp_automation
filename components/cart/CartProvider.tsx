"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  addItem as addItemOp,
  clearCart as clearCartOp,
  countItems,
  estimateSubtotal,
  parseStoredCart,
  removeItem as removeItemOp,
  setQuantity as setQuantityOp,
} from "@/lib/cart/store";
import type { AddItemInput, CartItems } from "@/lib/cart/types";

const STORAGE_KEY = "trolift-cart-v1";

interface CartContextValue {
  items: CartItems;
  count: number;
  /** Display-only estimate in paise (server reprices at checkout). */
  subtotalPaise: number;
  addItem: (input: AddItemInput) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadStored(): CartItems {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseStoredCart(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/**
 * Cart state provider: in-memory source of truth, localStorage mirror,
 * cross-tab sync. Mount once in the public layout shell.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItems>(() =>
    typeof window === "undefined" ? [] : loadStored(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Private-mode quota etc. — cart still works for the session.
    }
  }, [items]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setItems(parseStoredCart(e.newValue ? (JSON.parse(e.newValue) as unknown) : []));
      } catch {
        // Keep current state on corrupt cross-tab writes.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback(
    (input: AddItemInput) => setItems((prev) => addItemOp(prev, input)),
    [],
  );
  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      setItems((prev) => setQuantityOp(prev, productId, quantity)),
    [],
  );
  const removeItem = useCallback(
    (productId: string) => setItems((prev) => removeItemOp(prev, productId)),
    [],
  );
  const clearCart = useCallback(() => setItems(clearCartOp()), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: countItems(items),
      subtotalPaise: estimateSubtotal(items),
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, addItem, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>.");
  return ctx;
}

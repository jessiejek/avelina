import { supabase } from "./supabase.ts";
import { disablePush } from "./push.ts";

// localStorage keys that hold per-customer data. Cleared on sign-out so the
// next person on a shared device doesn't inherit the cart, contact details
// or order list.
export const STORAGE_KEYS = {
  cart: "avelinas_cart_v1",
  guest: "majalditas_guest_v1",
  orders: "majalditas_orders_v1",
} as const;

export function clearCustomerStorage() {
  for (const key of Object.values(STORAGE_KEYS)) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
}

/** Sign out everywhere: unlink this device's push token, wipe local customer data, end the session. */
export async function signOut() {
  // Must run while the session is still valid (push_tokens RLS = own rows).
  await disablePush();
  clearCustomerStorage();
  await supabase.auth.signOut();
}

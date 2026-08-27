import { NextResponse } from "next/server";
import { isShopifyConfigured, listProducts } from "@/lib/shopify";

// Server-only route -- this is the one place the private Storefront API
// token is ever used. The Shop page (a client component, so it can share
// the same signed-in gate as the rest of the Galaxy) calls this route
// instead of talking to Shopify directly.
export async function GET() {
  if (!isShopifyConfigured) {
    return NextResponse.json({ configured: false, products: [] });
  }
  try {
    const products = await listProducts();
    return NextResponse.json({ configured: true, products });
  } catch (err) {
    // Full detail goes to the server log only -- visitors just see a
    // plain, honest message rather than raw API internals.
    console.error("Shopify product fetch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { configured: true, products: [], error: "Couldn't reach the shop right now." },
      { status: 502 }
    );
  }
}

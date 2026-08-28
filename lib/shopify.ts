// Shopify Storefront API -- plain GraphQL over fetch, no SDK dependency.
// isShopifyConfigured is false until SHOPIFY_STORE_DOMAIN and
// SHOPIFY_STOREFRONT_ACCESS_TOKEN are set in .env.local (and on Vercel),
// so the shop route can report an honest "not connected yet" state
// instead of fake products until then.
//
// This file only ever runs server-side (imported by a Route Handler),
// so the private access token never reaches the browser.

const domain = process.env.SHOPIFY_STORE_DOMAIN; // e.g. "zfmixa-ka.myshopify.com"
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = "2026-01";

export const isShopifyConfigured = Boolean(domain && token);

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  priceAmount: string;
  priceCurrency: string;
  onlineStoreUrl: string | null;
}

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!domain || !token) {
    throw new Error("Shopify is not configured yet");
  }
  const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The PRIVATE Storefront API token (server-side use) authenticates
      // via a different header than the public/client-side token --
      // "X-Shopify-Storefront-Access-Token" is for the public token only.
      // Sending the private token under that header is what was causing
      // the 401 Unauthorized.
      "Shopify-Storefront-Private-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });

  // Read as text first -- Shopify can return a non-JSON body (an HTML
  // error page, an empty body, a plain-string error) for HTTP-level
  // failures like a bad domain, a revoked token, or a store that isn't
  // reachable yet. Parsing straight to JSON in that case throws a blank
  // or unhelpful error, which is what was happening here.
  const rawBody = await res.text();

  if (!res.ok) {
    throw new Error(
      `Shopify responded ${res.status} ${res.statusText} for https://${domain}/api/${API_VERSION}/graphql.json -- body: ${rawBody.slice(0, 300) || "(empty)"}`
    );
  }

  let json: ShopifyGraphQLResponse<T>;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new Error(`Shopify returned a non-JSON response: ${rawBody.slice(0, 300) || "(empty)"}`);
  }

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      json.errors.map((e) => e.message || JSON.stringify(e)).join("; ")
    );
  }
  if (!json.data) {
    throw new Error("Shopify returned no data");
  }
  return json.data;
}

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  description: string;
  onlineStoreUrl: string | null;
  images: { edges: Array<{ node: { url: string } }> };
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
};

interface ProductsQueryResult {
  products: { edges: Array<{ node: ProductNode }> };
}

interface CollectionProductsQueryResult {
  collection: { products: { edges: Array<{ node: ProductNode }> } } | null;
}

function mapProduct(node: ProductNode): ShopifyProduct {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: node.description,
    imageUrl: node.images.edges[0]?.node.url ?? null,
    priceAmount: node.priceRange.minVariantPrice.amount,
    priceCurrency: node.priceRange.minVariantPrice.currencyCode,
    onlineStoreUrl: node.onlineStoreUrl,
  };
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  onlineStoreUrl
  images(first: 1) {
    edges { node { url } }
  }
  priceRange {
    minVariantPrice { amount currencyCode }
  }
`;

// The Merch Ship deliberately shows a hand-picked selection, not just
// "whatever Shopify returns first" -- Rob curates exactly what's
// featured (and in what order) by arranging products inside this one
// Shopify Collection. Rearranging it there is instant; no code change,
// no redeploy, on the site's end.
const FEATURED_COLLECTION_HANDLE = "same-heart-page";

async function listFeaturedCollectionProducts(first: number): Promise<ShopifyProduct[] | null> {
  const query = `
    query CollectionProducts($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        products(first: $first) {
          edges { node { ${PRODUCT_FIELDS} } }
        }
      }
    }
  `;
  const data = await shopifyFetch<CollectionProductsQueryResult>(query, {
    handle: FEATURED_COLLECTION_HANDLE,
    first,
  });
  if (!data.collection) return null; // handle doesn't exist (yet) -- fall back
  return data.collection.products.edges.map(({ node }) => mapProduct(node));
}

async function listAllProducts(first: number): Promise<ShopifyProduct[]> {
  const query = `
    query Products($first: Int!) {
      products(first: $first) {
        edges { node { ${PRODUCT_FIELDS} } }
      }
    }
  `;
  const data = await shopifyFetch<ProductsQueryResult>(query, { first });
  return data.products.edges.map(({ node }) => mapProduct(node));
}

export async function listProducts(first = 24): Promise<ShopifyProduct[]> {
  // Prefer the curated "same-heart-page" collection. If it's ever
  // missing (deleted, renamed, or not created yet), fall back to
  // Shopify's default product list rather than showing an empty shop.
  const featured = await listFeaturedCollectionProducts(first);
  if (featured && featured.length > 0) return featured;
  return listAllProducts(first);
}

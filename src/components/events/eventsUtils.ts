const ASSETS_BASE_URL = import.meta.env.PUBLIC_FIREBASE_ASSETS_BASE_URL ?? "";

export function assetUrl(path: string) {
  if (!ASSETS_BASE_URL) return path;

  return `${ASSETS_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function formatPrice(price: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(price);
}

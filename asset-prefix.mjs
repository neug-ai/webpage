export const locales = ["en", "zh"];

export const getAssetPrefix = () =>
  (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export const withAssetPrefix = (value) => {
  const prefix = getAssetPrefix();
  if (!prefix || typeof value !== "string" || !value.startsWith("/") || value.startsWith(`${prefix}/`)) {
    return value;
  }
  return `${prefix}${value}`;
};

const backendOrigin = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const API = `${backendOrigin}/api`;

export const backendAsset = (value) => {
  const asset = String(value || "").trim();
  if (!asset) return "";

  // Uploaded images live on the API deployment, while the production client
  // is hosted separately. Also repair old database rows saved with a local
  // development origin.
  if (asset.startsWith("/uploads/")) {
    return `${backendOrigin}${asset}`;
  }
  if (backendOrigin && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/uploads\//i.test(asset)) {
    return `${backendOrigin}${new URL(asset).pathname}`;
  }
  return asset;
};

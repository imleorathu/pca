const backendOrigin = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const API = `${backendOrigin}/api`;

export const backendAsset = (value) => {
  if (!value || !backendOrigin || !String(value).startsWith("/uploads/")) {
    return value;
  }
  return `${backendOrigin}${value}`;
};

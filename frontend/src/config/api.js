/**
 * Global API Configuration for LOGOS.AI
 * Supports local development and production deployments (Vercel, Render, AWS, Docker)
 */

export const getBaseUrl = () => {
  // 1. Explicitly configured public API URL takes precedence
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 2. If running in browser in production (e.g. on Vercel)
  if (typeof window !== "undefined") {
    const isLocalhost = 
      window.location.hostname === "localhost" || 
      window.location.hostname === "127.0.0.1" || 
      window.location.hostname === "0.0.0.0";
    
    if (!isLocalhost) {
      return "";
    }
  }

  // 3. Localhost fallback
  return "http://localhost:8000";
};

export const API_BASE_URL = getBaseUrl();

export const getApiUrl = (endpoint = "") => {
  const base = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
};

export default getApiUrl;


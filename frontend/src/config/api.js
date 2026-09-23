/**
 * Global API Configuration for LOGOS.AI
 * Supports local development and production deployments (Vercel, AWS, Docker, etc.)
 */
export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.NEXT_PUBLIC_BACKEND_URL || 
  "http://localhost:8000";

export const getApiUrl = (endpoint = "") => {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

export default API_BASE_URL;

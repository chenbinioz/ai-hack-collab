/** Live FastAPI backend on Render (team generation, draft teams, educator-data). */
export const PRODUCTION_BACKEND_URL = "https://ai-hack-collab.onrender.com";

export function resolveBackendUrlFromEnv(): string {
  const fromPublic = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromPublic) {
    return fromPublic.replace("://localhost", "://127.0.0.1");
  }

  const fromBackend = process.env.BACKEND_URL?.trim();
  if (fromBackend) {
    return fromBackend.replace("://localhost", "://127.0.0.1");
  }

  if (process.env.VERCEL === "1") {
    return PRODUCTION_BACKEND_URL;
  }

  // Default to the live Render backend so team generation works without a local uvicorn process.
  // Set NEXT_PUBLIC_API_URL=http://localhost:8000 to use a local backend instead.
  return PRODUCTION_BACKEND_URL;
}

/** Browser-side URL for the FastAPI matching backend (must match Vercel env at build time). */
export function getPublicBackendUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:8000";
  return raw.replace("://localhost", "://127.0.0.1");
}

/** Server-side URL for the FastAPI matching backend. */
export function getBackendUrl(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:8000";

  // Prefer IPv4 loopback — on macOS `localhost` may resolve to ::1 while uvicorn binds 127.0.0.1.
  return raw.replace("://localhost", "://127.0.0.1");
}

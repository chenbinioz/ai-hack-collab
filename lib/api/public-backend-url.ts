import { PRODUCTION_BACKEND_URL, resolveBackendUrlFromEnv } from "@/lib/api/backend-constants";

/** Browser-side URL for the FastAPI matching backend. */
export function getPublicBackendUrl(): string {
  let url = resolveBackendUrlFromEnv();

  // Safety net: never call loopback from a non-local browser tab (stale build env, etc.).
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLoopbackTarget =
      url.includes("127.0.0.1") || url.startsWith("http://localhost");
    const isLocalBrowser =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (isLoopbackTarget && !isLocalBrowser) {
      url = PRODUCTION_BACKEND_URL;
    }
  }

  return url;
}

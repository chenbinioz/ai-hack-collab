import { PRODUCTION_BACKEND_URL, resolveBackendUrlFromEnv } from "@/lib/api/backend-constants";

/** Browser-side URL for the FastAPI matching backend. */
export function getPublicBackendUrl(): string {
  let url = resolveBackendUrlFromEnv();

  // Safety net: deployed frontend must not call loopback when env was missing at build time.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLoopbackTarget =
      url.includes("127.0.0.1") || url.startsWith("http://localhost");
    const isDeployedHost =
      host.endsWith(".vercel.app") || host.includes("cohort-connect");
    if (isLoopbackTarget && isDeployedHost) {
      url = PRODUCTION_BACKEND_URL;
    }
  }

  return url;
}

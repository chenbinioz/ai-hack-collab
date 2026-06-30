import { resolveBackendUrlFromEnv } from "@/lib/api/backend-constants";

/** Server-side URL for the FastAPI matching backend. */
export function getBackendUrl(): string {
  return resolveBackendUrlFromEnv();
}

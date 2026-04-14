import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load `.env` / `.env.local` before reading `process.env` here (Next does not always
// evaluate env files before this module runs in all tooling paths).
loadEnvConfig(process.cwd());

/**
 * Map canonical `SUPABASE_*` env vars into `NEXT_PUBLIC_*` so the browser bundle,
 * middleware, and server share one configuration without hardcoding secrets in repo.
 */
const studentSupabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const studentSupabaseAnonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: studentSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: studentSupabaseAnonKey,
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000",
  },
};

export default nextConfig;

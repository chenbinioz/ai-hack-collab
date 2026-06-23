// Keep config minimal and avoid depending on @next/env which may not be present
// when Node packages are out-of-sync. Environment variables will still be
// available via process.env in most dev setups.
const studentSupabaseUrl =
  (process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim()) ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.trim()) ||
  "";
const studentSupabaseAnonKey =
  (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim()) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()) ||
  "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: studentSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: studentSupabaseAnonKey,
    NEXT_PUBLIC_API_URL: (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) || "http://localhost:8000",
  },
};

module.exports = nextConfig;

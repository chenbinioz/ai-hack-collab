#!/usr/bin/env node
/**
 * Generate Supabase password recovery links for smoke-test accounts.
 * Usage: node scripts/reset-smoke-test-passwords.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ACCOUNTS = [
  "prof.james@imperial.ac.uk",
  "zuri.jarvis25@imperial.ac.uk",
];

async function main() {
  console.log("Generating password recovery links (original passwords cannot be restored):\n");

  for (const email of ACCOUNTS) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      console.error(`✗ ${email}: ${error.message}`);
      continue;
    }

    console.log(`${email}`);
    console.log(`  ${data.properties?.action_link ?? "(no link returned)"}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

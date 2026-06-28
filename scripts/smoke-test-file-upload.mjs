#!/usr/bin/env node
/**
 * Smoke tests for assignment + chat file uploads.
 * Usage: node scripts/smoke-test-file-upload.mjs
 * Requires .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.SMOKE_APP_URL ?? "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD;
const SET_TEST_PASSWORD = process.env.SMOKE_SET_PASSWORD === "true";

if (!TEST_PASSWORD) {
  console.error(
    "Set SMOKE_TEST_PASSWORD in the environment to the known password for smoke-test accounts.",
  );
  console.error("Do not set SMOKE_SET_PASSWORD unless you intentionally want to overwrite account passwords.");
  process.exit(1);
}

const EDUCATOR = {
  id: "022df36e-f7fc-4d30-abd3-b5f114f2681f",
  email: "prof.james@imperial.ac.uk",
};
const STUDENT = {
  id: "38b63c85-a885-47e1-aeef-287a5ea338eb",
  email: "zuri.jarvis25@imperial.ac.uk",
};
const CLASS_ID = "f632b76f-2172-4f1c-bbd5-6e474c18f0a3";
const ASSIGNMENT_ID = "9f042464-1927-4a51-8c12-cf4c8353a875";
const TEAM_ID = "319328f1-7441-45dd-a57e-a32c7605b746";

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
}

async function ensurePassword(userId, email) {
  if (!SET_TEST_PASSWORD) return;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Failed to set password for ${email}: ${error.message}`);
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Sign in failed for ${email}: ${error?.message}`);
  }
  return { client, session: data.session };
}

async function verifySchema() {
  const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
  if (bucketErr) throw new Error(`listBuckets: ${bucketErr.message}`);
  const bucketIds = new Set(buckets.map((b) => b.id));
  if (!bucketIds.has("assignment-files") || !bucketIds.has("chat-files")) {
    throw new Error("Missing storage buckets");
  }

  await ensurePassword(STUDENT.id, STUDENT.email);
  const { client } = await signIn(STUDENT.email);
  const { error: rpcError } = await client.rpc("get_team_messages", {
    p_team_id: TEAM_ID,
  });
  if (rpcError) throw new Error(`get_team_messages RPC: ${rpcError.message}`);

  pass("Schema: buckets exist and get_team_messages RPC works");
}

async function testEducatorAssignmentUpload() {
  await ensurePassword(EDUCATOR.id, EDUCATOR.email);
  const { client, session } = await signIn(EDUCATOR.email);

  const attachmentId = crypto.randomUUID();
  const fileName = "smoke-test-rubric.txt";
  const content = "Smoke test assignment resource\n";
  const storagePath = `${ASSIGNMENT_ID}/${attachmentId}/${fileName}`;

  const blob = new Blob([content], { type: "text/plain" });
  const { error: uploadError } = await client.storage
    .from("assignment-files")
    .upload(storagePath, blob, { contentType: "text/plain", upsert: false });
  if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

  const registerRes = await fetch(
    `${APP_URL}/api/educator/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        id: attachmentId,
        file_name: fileName,
        mime_type: "text/plain",
        size_bytes: content.length,
        storage_path: storagePath,
      }),
    },
  );
  if (!registerRes.ok) {
    const body = await registerRes.text();
    throw new Error(`Register attachment API ${registerRes.status}: ${body}`);
  }

  const listRes = await fetch(
    `${APP_URL}/api/educator/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (!listRes.ok) {
    throw new Error(`List attachments API ${listRes.status}`);
  }
  const listJson = await listRes.json();
  const found = (listJson.attachments ?? []).find((a) => a.id === attachmentId);
  if (!found?.download_url) {
    throw new Error("Registered attachment missing from list or download_url");
  }

  const downloadRes = await fetch(found.download_url);
  if (!downloadRes.ok) {
    throw new Error(`Download URL failed: ${downloadRes.status}`);
  }
  const downloaded = await downloadRes.text();
  if (!downloaded.includes("Smoke test assignment resource")) {
    throw new Error("Downloaded content mismatch");
  }

  const deleteRes = await fetch(
    `${APP_URL}/api/educator/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (!deleteRes.ok) {
    throw new Error(`Delete attachment API ${deleteRes.status}`);
  }

  pass("Educator: upload, list, download, delete assignment file");
  return attachmentId;
}

async function testStudentAssignmentDownload() {
  await ensurePassword(EDUCATOR.id, EDUCATOR.email);
  await ensurePassword(STUDENT.id, STUDENT.email);

  const { client: educatorClient, session: educatorSession } = await signIn(
    EDUCATOR.email,
  );

  const attachmentId = crypto.randomUUID();
  const fileName = "smoke-student-resource.txt";
  const content = "Student-visible resource\n";
  const storagePath = `${ASSIGNMENT_ID}/${attachmentId}/${fileName}`;

  const blob = new Blob([content], { type: "text/plain" });
  const { error: uploadError } = await educatorClient.storage
    .from("assignment-files")
    .upload(storagePath, blob, { contentType: "text/plain", upsert: false });
  if (uploadError) throw new Error(`Educator storage upload: ${uploadError.message}`);

  const registerRes = await fetch(
    `${APP_URL}/api/educator/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${educatorSession.access_token}`,
      },
      body: JSON.stringify({
        id: attachmentId,
        file_name: fileName,
        mime_type: "text/plain",
        size_bytes: content.length,
        storage_path: storagePath,
      }),
    },
  );
  if (!registerRes.ok) {
    throw new Error(`Register for student test failed: ${registerRes.status}`);
  }

  const { session: studentSession } = await signIn(STUDENT.email);
  const studentRes = await fetch(
    `${APP_URL}/api/student/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments`,
    {
      headers: { Authorization: `Bearer ${studentSession.access_token}` },
    },
  );
  if (!studentRes.ok) {
    throw new Error(`Student list API ${studentRes.status}`);
  }
  const studentJson = await studentRes.json();
  const found = (studentJson.attachments ?? []).find((a) => a.id === attachmentId);
  if (!found?.download_url) {
    throw new Error("Student cannot see assignment attachment");
  }

  await fetch(
    `${APP_URL}/api/educator/classes/${CLASS_ID}/assignments/${ASSIGNMENT_ID}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${educatorSession.access_token}` },
    },
  );

  pass("Student: can list and get download URL for assignment resources");
}

async function testChatAttachment() {
  await ensurePassword(STUDENT.id, STUDENT.email);
  const { client, session } = await signIn(STUDENT.email);

  const messageId = crypto.randomUUID();
  const fileName = "smoke-chat-note.txt";
  const content = "Chat attachment smoke test\n";
  const storagePath = `${TEAM_ID}/${messageId}/${fileName}`;

  const blob = new Blob([content], { type: "text/plain" });
  const { error: uploadError } = await client.storage
    .from("chat-files")
    .upload(storagePath, blob, { contentType: "text/plain", upsert: false });
  if (uploadError) throw new Error(`Chat storage upload: ${uploadError.message}`);

  const { data: sentId, error: sendError } = await client.rpc("send_team_message", {
    p_team_id: TEAM_ID,
    p_content: "Here is the file",
    p_message_id: messageId,
    p_file_name: fileName,
    p_mime_type: "text/plain",
    p_size_bytes: content.length,
    p_storage_path: storagePath,
  });
  if (sendError) throw new Error(`send_team_message: ${sendError.message}`);
  if (sentId !== messageId) throw new Error("send_team_message returned unexpected id");

  const { data: messages, error: fetchError } = await client.rpc("get_team_messages", {
    p_team_id: TEAM_ID,
  });
  if (fetchError) throw new Error(`get_team_messages: ${fetchError.message}`);

  const msg = (messages ?? []).find((m) => m.id === messageId);
  if (!msg?.attachment_id || msg.file_name !== fileName) {
    throw new Error("Message attachment not returned by get_team_messages");
  }

  const { data: signed, error: signError } = await client.storage
    .from("chat-files")
    .createSignedUrl(storagePath, 3600);
  if (signError || !signed?.signedUrl) {
    throw new Error(`Chat signed URL: ${signError?.message}`);
  }

  const downloadRes = await fetch(signed.signedUrl);
  if (!downloadRes.ok) throw new Error(`Chat download failed: ${downloadRes.status}`);

  // File-only message
  const fileOnlyId = crypto.randomUUID();
  const fileOnlyPath = `${TEAM_ID}/${fileOnlyId}/file-only.txt`;
  const fileOnlyBlob = new Blob(["file only"], { type: "text/plain" });
  const { error: fileOnlyUploadErr } = await client.storage
    .from("chat-files")
    .upload(fileOnlyPath, fileOnlyBlob, { contentType: "text/plain" });
  if (fileOnlyUploadErr) throw new Error(fileOnlyUploadErr.message);

  const { error: fileOnlySendErr } = await client.rpc("send_team_message", {
    p_team_id: TEAM_ID,
    p_content: "",
    p_message_id: fileOnlyId,
    p_file_name: "file-only.txt",
    p_mime_type: "text/plain",
    p_size_bytes: 8,
    p_storage_path: fileOnlyPath,
  });
  if (fileOnlySendErr) throw new Error(`file-only send: ${fileOnlySendErr.message}`);

  pass("Chat: text+file, file-only message, get_team_messages with attachment");
}

async function main() {
  console.log("Running file upload smoke tests...\n");

  try {
    await verifySchema();
    await testEducatorAssignmentUpload();
    await testStudentAssignmentDownload();
    await testChatAttachment();
  } catch (err) {
    fail("Smoke test run", err instanceof Error ? err.message : String(err));
  }

  console.log("\n--- Summary ---");
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log(`All ${results.length} checks passed.`);
    process.exit(0);
  } else {
    console.log(`${failed.length} failed, ${results.filter((r) => r.ok).length} passed.`);
    process.exit(1);
  }
}

main();

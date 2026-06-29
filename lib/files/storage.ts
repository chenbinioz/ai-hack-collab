import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSIGNMENT_FILES_BUCKET,
  CHAT_FILES_BUCKET,
  CLASS_EXTERNAL_DATA_BUCKET,
} from "./constants";
import { sanitizeFileName } from "./validation";

export function buildAssignmentStoragePath(
  assignmentId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${assignmentId}/${attachmentId}/${sanitizeFileName(fileName)}`;
}

export function buildChatStoragePath(
  teamId: string,
  messageId: string,
  fileName: string,
): string {
  return `${teamId}/${messageId}/${sanitizeFileName(fileName)}`;
}

export function buildClassExternalDataStoragePath(
  classId: string,
  layerId: string,
  fileType: string,
): string {
  return `${classId}/${layerId}/${fileType}.csv`;
}

export async function uploadClassExternalDataFile(
  supabase: SupabaseClient,
  classId: string,
  layerId: string,
  fileType: string,
  file: File,
): Promise<string> {
  const storagePath = buildClassExternalDataStoragePath(classId, layerId, fileType);

  const { error } = await supabase.storage
    .from(CLASS_EXTERNAL_DATA_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "text/csv",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function uploadAssignmentFile(
  supabase: SupabaseClient,
  assignmentId: string,
  file: File,
  attachmentId?: string,
): Promise<{ storagePath: string; attachmentId: string }> {
  const id = attachmentId ?? crypto.randomUUID();
  const storagePath = buildAssignmentStoragePath(assignmentId, id, file.name);

  const { error } = await supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { storagePath, attachmentId: id };
}

export async function uploadChatFile(
  supabase: SupabaseClient,
  teamId: string,
  messageId: string,
  file: File,
): Promise<string> {
  const storagePath = buildChatStoragePath(teamId, messageId, file.name);

  const { error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function getSignedDownloadUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create download URL");
  }

  return data.signedUrl;
}

export async function deleteStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.warn(`Failed to delete storage object ${bucket}/${path}:`, error.message);
  }
}

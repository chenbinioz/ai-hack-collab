import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";
import { ASSIGNMENT_FILES_BUCKET } from "@/lib/files/constants";
import { getSignedDownloadUrl } from "@/lib/files/storage";

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ classId: string; assignmentId: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId, assignmentId } = await params;

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: enrollment } = await supabase
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: assignment } = await supabase
      .from("assignments")
      .select("id")
      .eq("id", assignmentId)
      .eq("class_id", classId)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: attachments, error: fetchError } = await supabase
      .from("assignment_attachments")
      .select("id, file_name, mime_type, size_bytes, created_at, storage_path")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching student assignment attachments:", fetchError);
      return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
    }

    const withUrls = await Promise.all(
      (attachments ?? []).map(async (attachment) => {
        try {
          const download_url = await getSignedDownloadUrl(
            supabase,
            ASSIGNMENT_FILES_BUCKET,
            attachment.storage_path,
          );
          return {
            id: attachment.id,
            file_name: attachment.file_name,
            mime_type: attachment.mime_type,
            size_bytes: attachment.size_bytes,
            created_at: attachment.created_at,
            download_url,
          };
        } catch {
          return {
            id: attachment.id,
            file_name: attachment.file_name,
            mime_type: attachment.mime_type,
            size_bytes: attachment.size_bytes,
            created_at: attachment.created_at,
            download_url: null,
          };
        }
      }),
    );

    return NextResponse.json({ attachments: withUrls });
  } catch (error) {
    console.error(
      "Error in GET /api/student/classes/[classId]/assignments/[assignmentId]/attachments:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

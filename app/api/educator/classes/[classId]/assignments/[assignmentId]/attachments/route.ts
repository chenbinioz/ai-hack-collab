import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";
import { ASSIGNMENT_FILES_BUCKET } from "@/lib/files/constants";
import { getSignedDownloadUrl } from "@/lib/files/storage";

async function verifyEducatorOwnsClass(
  supabase: Awaited<ReturnType<typeof createClientFromRequest>>,
  classId: string,
  educatorId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("educator_id", educatorId)
    .single();

  return !error && !!data;
}

async function verifyAssignmentInClass(
  supabase: Awaited<ReturnType<typeof createClientFromRequest>>,
  classId: string,
  assignmentId: string,
) {
  const { data, error } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .single();

  return !error && !!data;
}

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

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const assignmentValid = await verifyAssignmentInClass(supabase, classId, assignmentId);
    if (!assignmentValid) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: attachments, error: fetchError } = await supabase
      .from("assignment_attachments")
      .select("id, assignment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching assignment attachments:", fetchError);
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
          return { ...attachment, download_url };
        } catch {
          return { ...attachment, download_url: null };
        }
      }),
    );

    return NextResponse.json({ attachments: withUrls });
  } catch (error) {
    console.error(
      "Error in GET /api/educator/classes/[classId]/assignments/[assignmentId]/attachments:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const assignmentValid = await verifyAssignmentInClass(supabase, classId, assignmentId);
    if (!assignmentValid) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const body = await request.json();
    const { id, file_name, mime_type, size_bytes, storage_path } = body;

    if (!file_name || typeof file_name !== "string") {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 });
    }
    if (!mime_type || typeof mime_type !== "string") {
      return NextResponse.json({ error: "mime_type is required" }, { status: 400 });
    }
    if (!size_bytes || typeof size_bytes !== "number" || size_bytes <= 0) {
      return NextResponse.json({ error: "size_bytes must be a positive number" }, { status: 400 });
    }
    if (!storage_path || typeof storage_path !== "string") {
      return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
    }

    if (!storage_path.startsWith(`${assignmentId}/`)) {
      return NextResponse.json({ error: "Invalid storage_path for this assignment" }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      assignment_id: assignmentId,
      storage_path,
      file_name,
      mime_type,
      size_bytes,
      uploaded_by: user.id,
    };

    if (id && typeof id === "string") {
      insertData.id = id;
    }

    const { data: attachment, error: insertError } = await supabase
      .from("assignment_attachments")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Error registering assignment attachment:", insertError);
      return NextResponse.json({ error: "Failed to register attachment" }, { status: 500 });
    }

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    console.error(
      "Error in POST /api/educator/classes/[classId]/assignments/[assignmentId]/attachments:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";
import { ASSIGNMENT_FILES_BUCKET } from "@/lib/files/constants";
import { deleteStorageObject } from "@/lib/files/storage";

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

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ classId: string; assignmentId: string; attachmentId: string }>;
  },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId, assignmentId, attachmentId } = await params;

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: attachment, error: fetchError } = await supabase
      .from("assignment_attachments")
      .select("id, storage_path, assignment_id")
      .eq("id", attachmentId)
      .eq("assignment_id", assignmentId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const { data: assignment } = await supabase
      .from("assignments")
      .select("id")
      .eq("id", assignmentId)
      .eq("class_id", classId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("assignment_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) {
      console.error("Error deleting assignment attachment:", deleteError);
      return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
    }

    await deleteStorageObject(supabase, ASSIGNMENT_FILES_BUCKET, attachment.storage_path);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in DELETE .../attachments/[attachmentId]:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

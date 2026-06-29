import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server-client";
import { resolveRequestUser } from "@/lib/auth/request-user";

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

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ classId: string; assignmentId: string; taskId: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId, assignmentId, taskId } = await params;

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

    const { error: deleteError } = await supabase
      .from("assignment_progress_tasks")
      .delete()
      .eq("id", taskId)
      .eq("assignment_id", assignmentId);

    if (deleteError) {
      console.error("Error deleting progress task:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in DELETE /api/educator/classes/[classId]/assignments/[assignmentId]/progress/tasks/[taskId]:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

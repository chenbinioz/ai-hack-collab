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

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const { data: maxRow, error: maxError } = await supabase
      .from("assignment_progress_tasks")
      .select("sort_order")
      .eq("assignment_id", assignmentId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("Error reading task order:", maxError);
      return NextResponse.json({ error: maxError.message }, { status: 500 });
    }

    const { data: task, error: insertError } = await supabase
      .from("assignment_progress_tasks")
      .insert({
        assignment_id: assignmentId,
        assignment_progress_id: assignmentId,
        title,
        sort_order: (maxRow?.sort_order ?? -1) + 1,
      })
      .select("id, title, sort_order, created_at")
      .single();

    if (insertError || !task) {
      console.error("Error creating progress task:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to add task" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error(
      "Error in POST /api/educator/classes/[classId]/assignments/[assignmentId]/progress/tasks:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

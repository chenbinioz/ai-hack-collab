import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; assignmentId: string }> },
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

    const body = await request.json();
    const { title, description, due_date, max_team_size, ai_preferences, sort_order } = body;

    const updates: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Assignment title cannot be empty" }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (due_date !== undefined) {
      if (due_date === null) {
        updates.due_date = null;
      } else {
        const candidate = new Date(due_date);
        if (Number.isNaN(candidate.getTime())) {
          return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
        }
        updates.due_date = candidate.toISOString();
      }
    }

    if (max_team_size !== undefined) {
      updates.max_team_size = Math.max(2, Math.min(10, max_team_size));
    }

    if (ai_preferences !== undefined) {
      updates.ai_preferences = ai_preferences;
    }

    if (sort_order !== undefined) {
      updates.sort_order = sort_order;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: assignment, error: updateError } = await supabase
      .from("assignments")
      .update(updates)
      .eq("id", assignmentId)
      .eq("class_id", classId)
      .select()
      .single();

    if (updateError || !assignment) {
      console.error("Error updating assignment:", updateError);
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("Error in PATCH /api/educator/classes/[classId]/assignments/[assignmentId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; assignmentId: string }> },
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

    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("class_id", classId);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/educator/classes/[classId]/assignments/[assignmentId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

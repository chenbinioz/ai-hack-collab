import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";

const DEFAULT_AI_PREFERENCES = {
  focus_skills: true,
  focus_working_style: true,
  focus_availability: true,
  balance_diversity: true,
};

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId } = await params;

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .order("sort_order", { ascending: true });

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
    }

    return NextResponse.json({ assignments: assignments || [] });
  } catch (error) {
    console.error("Error in GET /api/educator/classes/[classId]/assignments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId } = await params;

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, due_date, max_team_size, ai_preferences } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Assignment title is required" }, { status: 400 });
    }

    let parsedDueDate: string | null = null;
    if (due_date) {
      const candidate = new Date(due_date);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
      }
      parsedDueDate = candidate.toISOString();
    }

    const { data: maxSortRow } = await supabase
      .from("assignments")
      .select("sort_order")
      .eq("class_id", classId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = (maxSortRow?.sort_order ?? -1) + 1;

    const assignmentData = {
      class_id: classId,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: parsedDueDate,
      max_team_size: Math.max(2, Math.min(10, max_team_size || 3)),
      ai_preferences: ai_preferences || DEFAULT_AI_PREFERENCES,
      sort_order: sortOrder,
      created_by: user.id,
    };

    const { data: assignment, error: createError } = await supabase
      .from("assignments")
      .insert(assignmentData)
      .select()
      .single();

    if (createError) {
      console.error("Error creating assignment:", createError);
      return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
    }

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("Error in POST /api/educator/classes/[classId]/assignments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

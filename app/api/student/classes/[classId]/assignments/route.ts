import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const supabase = await createClient();
    const { classId } = await params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: rows, error: assignmentsError } = await supabase.rpc("list_student_assignments", {
      p_class_id: classId,
    });

    if (assignmentsError) {
      console.error("Error fetching student assignments via RPC:", assignmentsError);
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
    }

    const assignments = (rows || []).map((row: {
      assignment_id: string;
      class_id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      max_team_size: number;
      ai_preferences: unknown;
      sort_order: number;
      team_id: string | null;
    }) => ({
      id: row.assignment_id,
      class_id: row.class_id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      max_team_size: row.max_team_size,
      ai_preferences: row.ai_preferences,
      sort_order: row.sort_order,
      team_id: row.team_id,
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error in GET /api/student/classes/[classId]/assignments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: classRows, error: classesError } = await supabase.rpc("list_student_classes");

    if (classesError) {
      console.error("Error fetching student classes via RPC:", classesError);
      return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
    }

    const classes = (classRows || []).map((row: any) => ({
      id: row.class_id,
      name: row.name,
      description: row.description,
      code: row.code,
      coursework_deadline: row.coursework_deadline ?? null,
      enrolled_at: row.enrolled_at,
      role: row.role,
      max_team_size: row.max_team_size,
      ai_preferences: row.ai_preferences,
    }));

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Error in GET /api/student/classes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
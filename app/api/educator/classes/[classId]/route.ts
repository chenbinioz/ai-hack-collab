import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const supabase = await createClient();
    const { classId } = await params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { coursework_deadline } = body;

    let parsedDeadline: string | null = null;
    if (coursework_deadline) {
      const candidate = new Date(coursework_deadline);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json({ error: "Invalid coursework deadline" }, { status: 400 });
      }
      parsedDeadline = candidate.toISOString();
    }

    const { data: updatedClass, error: updateError } = await supabase
      .from("classes")
      .update({ coursework_deadline: parsedDeadline })
      .eq("id", classId)
      .eq("educator_id", user.id)
      .select("*")
      .single();

    if (updateError || !updatedClass) {
      console.error("Error updating class deadline:", updateError);
      return NextResponse.json({ error: "Failed to update class deadline" }, { status: 500 });
    }

    return NextResponse.json({ success: true, class: updatedClass });
  } catch (error) {
    console.error("Error in PATCH /api/educator/classes/[classId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

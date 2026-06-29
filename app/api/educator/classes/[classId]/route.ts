import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";

export async function PATCH(
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

    const body = await request.json();
    const { name, description } = body;

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Class name cannot be empty" }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || "";
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedClass, error: updateError } = await supabase
      .from("classes")
      .update(updates)
      .eq("id", classId)
      .eq("educator_id", user.id)
      .select("*")
      .single();

    if (updateError || !updatedClass) {
      console.error("Error updating class:", updateError);
      return NextResponse.json({ error: "Failed to update class" }, { status: 500 });
    }

    return NextResponse.json({ success: true, class: updatedClass });
  } catch (error) {
    console.error("Error in PATCH /api/educator/classes/[classId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

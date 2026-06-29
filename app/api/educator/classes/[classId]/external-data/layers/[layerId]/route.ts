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
  { params }: { params: Promise<{ classId: string; layerId: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { classId, layerId } = await params;

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownsClass = await verifyEducatorOwnsClass(supabase, classId, user.id);
    if (!ownsClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const body = await request.json();
    const rawName = body?.name;
    if (typeof rawName !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const name = rawName.trim();
    if (!name) {
      return NextResponse.json({ error: "Layer name cannot be empty" }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: "Layer name must be 120 characters or fewer" }, { status: 400 });
    }

    const { data: layer, error: updateError } = await supabase
      .from("class_external_data_layers")
      .update({ name })
      .eq("id", layerId)
      .eq("class_id", classId)
      .select("id, layer_number, name, uploaded_at, processed_at, process_status, process_error")
      .single();

    if (updateError || !layer) {
      return NextResponse.json({ error: "Layer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, layer });
  } catch (error) {
    console.error("PATCH external-data layer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";
import {
  EXTERNAL_DATA_FILE_TYPES,
  type ExternalDataFileType,
} from "@/lib/external-data/constants";

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

async function verifyLayerInClass(
  supabase: Awaited<ReturnType<typeof createClientFromRequest>>,
  classId: string,
  layerId: string,
) {
  const { data, error } = await supabase
    .from("class_external_data_layers")
    .select("id, process_status")
    .eq("id", layerId)
    .eq("class_id", classId)
    .single();

  return error ? null : data;
}

export async function POST(
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

    const layer = await verifyLayerInClass(supabase, classId, layerId);
    if (!layer) {
      return NextResponse.json({ error: "Layer not found" }, { status: 404 });
    }

    const body = await request.json();
    const { file_type, file_name, storage_path, row_count } = body;

    if (!file_type || !EXTERNAL_DATA_FILE_TYPES.includes(file_type as ExternalDataFileType)) {
      return NextResponse.json({ error: "Invalid file_type" }, { status: 400 });
    }
    if (!file_name || typeof file_name !== "string") {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 });
    }
    if (!storage_path || typeof storage_path !== "string") {
      return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
    }
    if (!storage_path.startsWith(`${classId}/${layerId}/`)) {
      return NextResponse.json({ error: "Invalid storage_path for this layer" }, { status: 400 });
    }

    const { data: file, error: insertError } = await supabase
      .from("class_external_data_files")
      .upsert(
        {
          layer_id: layerId,
          file_type,
          storage_path,
          file_name,
          row_count: typeof row_count === "number" && row_count >= 0 ? row_count : 0,
        },
        { onConflict: "layer_id,file_type" },
      )
      .select()
      .single();

    if (insertError) {
      console.error("Register external data file error:", insertError);
      return NextResponse.json({ error: "Failed to register file" }, { status: 500 });
    }

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error("POST external-data file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

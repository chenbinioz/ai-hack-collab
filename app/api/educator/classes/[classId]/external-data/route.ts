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

    const { data: layers, error: layersError } = await supabase
      .from("class_external_data_layers")
      .select("id, layer_number, name, uploaded_at, processed_at, process_status, process_error")
      .eq("class_id", classId)
      .order("layer_number", { ascending: true });

    if (layersError) {
      return NextResponse.json({ error: "Failed to fetch layers" }, { status: 500 });
    }

    const layerIds = (layers ?? []).map((l) => l.id);
    let files: Array<{
      id: string;
      layer_id: string;
      file_type: string;
      file_name: string;
      row_count: number;
      uploaded_at: string;
    }> = [];

    if (layerIds.length > 0) {
      const { data: fileRows, error: filesError } = await supabase
        .from("class_external_data_files")
        .select("id, layer_id, file_type, file_name, row_count, uploaded_at")
        .in("layer_id", layerIds);

      if (filesError) {
        return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
      }
      files = fileRows ?? [];
    }

    const latestByType: Partial<
      Record<ExternalDataFileType, { layer_number: number; row_count: number; uploaded_at: string }>
    > = {};

    for (const layer of layers ?? []) {
      const layerFiles = files.filter((f) => f.layer_id === layer.id);
      for (const file of layerFiles) {
        const ft = file.file_type as ExternalDataFileType;
        if (!EXTERNAL_DATA_FILE_TYPES.includes(ft)) continue;
        const existing = latestByType[ft];
        if (!existing || layer.layer_number >= existing.layer_number) {
          latestByType[ft] = {
            layer_number: layer.layer_number,
            row_count: file.row_count,
            uploaded_at: file.uploaded_at,
          };
        }
      }
    }

    const { data: insights, error: insightsError } = await supabase
      .from("class_external_student_insights")
      .select("computed_at")
      .eq("class_id", classId)
      .order("computed_at", { ascending: false })
      .limit(1);

    if (insightsError) {
      return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
    }

    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, student_profiles!inner(survey_external_student_id)")
      .eq("class_id", classId);

    const enrolledExternalIds = (enrollments ?? [])
      .map((e) => {
        const profile = e.student_profiles as { survey_external_student_id?: string | null } | null;
        return profile?.survey_external_student_id ?? null;
      })
      .filter((id): id is string => !!id);

    const { count: insightCount } =
      enrolledExternalIds.length > 0
        ? await supabase
            .from("class_external_student_insights")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classId)
            .in("external_person_id", enrolledExternalIds)
        : { count: 0 };

    return NextResponse.json({
      layers: layers ?? [],
      files,
      latest_by_type: latestByType,
      last_insight_computed_at: insights?.[0]?.computed_at ?? null,
      matched_student_count: insightCount ?? 0,
      enrolled_with_external_id_count: enrolledExternalIds.length,
    });
  } catch (error) {
    console.error("GET external-data error:", error);
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

    const body = await request.json().catch(() => ({}));
    const requestedName = typeof body?.name === "string" ? body.name.trim() : "";

    const { data: nextLayer, error: rpcError } = await supabase.rpc(
      "next_class_external_data_layer_number",
      { p_class_id: classId },
    );

    if (rpcError) {
      return NextResponse.json({ error: "Failed to allocate layer number" }, { status: 500 });
    }

    const layerNumber = nextLayer as number;
    const defaultName = requestedName || `Layer ${layerNumber}`;

    const { data: layer, error: insertError } = await supabase
      .from("class_external_data_layers")
      .insert({
        class_id: classId,
        layer_number: layerNumber,
        name: defaultName,
        uploaded_by: user.id,
        process_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to create layer" }, { status: 500 });
    }

    return NextResponse.json({ layer });
  } catch (error) {
    console.error("POST external-data layer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

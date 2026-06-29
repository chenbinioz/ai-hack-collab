import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

    const authHeader = request.headers.get("authorization");
    const backendResponse = await fetch(
      `${API_BASE_URL}/educator/classes/${classId}/external-data/layers/${layerId}/process`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader ?? "",
          "Content-Type": "application/json",
        },
      },
    );

    const payload = await backendResponse.json();
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: payload.error ?? "Processing failed" },
        { status: backendResponse.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST external-data process error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json({ error: "Class code is required" }, { status: 400 });
    }

    // Use RPC function to join class
    const { data: result, error: joinError } = await supabase.rpc("join_class_by_code", {
      p_code: code.trim().toUpperCase()
    });

    if (joinError) {
      console.error("Error joining class:", joinError);
      return NextResponse.json({ error: "Failed to join class" }, { status: 500 });
    }

    if (!result || !result.success) {
      return NextResponse.json({ error: result?.error || "Failed to join class" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined class",
      class_id: result.class_id
    });
  } catch (error) {
    console.error("Error in POST /api/student/join-class:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
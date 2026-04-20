import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";

interface ClassData {
  id: string;
  educator_id: string;
  name: string;
  description: string;
  code: string;
  coursework_deadline: string | null;
  max_team_size: number;
  ai_preferences: any;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user from cookie session; fallback to bearer token for client fetches.
    let { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        const tokenUserResult = await supabase.auth.getUser(token);
        user = tokenUserResult.data.user;
        userError = tokenUserResult.error;
      }
    }

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get classes for this educator
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("*")
      .eq("educator_id", user.id)
      .order("created_at", { ascending: false });

    if (classesError) {
      console.error("Error fetching classes:", classesError);
      return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
    }

    // Get enrollment counts for each class
    const classesWithCounts = await Promise.all(
      (classes || []).map(async (classItem: ClassData) => {
        const { count } = await supabase
          .from("class_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("class_id", classItem.id);

        return {
          ...classItem,
          student_count: count || 0,
        };
      })
    );

    return NextResponse.json({ classes: classesWithCounts });
  } catch (error) {
    console.error("Error in GET /api/educator/classes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, max_team_size, ai_preferences, coursework_deadline } = body;
    let parsedDeadline: string | null = null;
    if (coursework_deadline) {
      const candidate = new Date(coursework_deadline);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json({ error: "Invalid coursework deadline" }, { status: 400 });
      }
      parsedDeadline = candidate.toISOString();
    }


    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 });
    }

    // Generate unique class code using RPC function
    const { data: classCode, error: codeError } = await supabase.rpc("generate_class_code");

    if (codeError || !classCode) {
      console.error("Error generating class code:", codeError);
      return NextResponse.json({ error: "Failed to generate class code" }, { status: 500 });
    }

    // Create the class
    const classData = {
      educator_id: user.id,
      name: name.trim(),
      description: description?.trim() || "",
      code: classCode,
      coursework_deadline: parsedDeadline,
      max_team_size: Math.max(2, Math.min(10, max_team_size || 3)),
      ai_preferences: ai_preferences || {
        focus_skills: true,
        focus_working_style: true,
        focus_availability: true,
        focus_goals: true,
        balance_diversity: true,
      },
    };

    const { data: newClass, error: createError } = await supabase
      .from("classes")
      .insert(classData)
      .select()
      .single();

    if (createError) {
      console.error("Error creating class:", createError);
      return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      class: newClass,
      join_code: classCode
    });
  } catch (error) {
    console.error("Error in POST /api/educator/classes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
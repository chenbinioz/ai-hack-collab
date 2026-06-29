import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUser } from "@/lib/auth/request-user";
import { createClientFromRequest } from "@/lib/supabase/server-client";

interface ClassData {
  id: string;
  educator_id: string;
  name: string;
  description: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("*")
      .eq("educator_id", user.id)
      .order("created_at", { ascending: false });

    if (classesError) {
      console.error("Error fetching classes:", classesError);
      return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
    }

    const classesWithCounts = await Promise.all(
      (classes || []).map(async (classItem: ClassData) => {
        const [{ count: studentCount }, { count: assignmentCount }] = await Promise.all([
          supabase
            .from("class_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classItem.id),
          supabase
            .from("assignments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classItem.id),
        ]);

        return {
          ...classItem,
          student_count: studentCount || 0,
          assignment_count: assignmentCount || 0,
        };
      }),
    );

    return NextResponse.json({ classes: classesWithCounts });
  } catch (error) {
    console.error("Error in GET /api/educator/classes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);

    const { user, error: userError } = await resolveRequestUser(supabase, request);
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 });
    }

    const { data: classCode, error: codeError } = await supabase.rpc("generate_class_code");

    if (codeError || !classCode) {
      console.error("Error generating class code:", codeError);
      return NextResponse.json({ error: "Failed to generate class code" }, { status: 500 });
    }

    const classData = {
      educator_id: user.id,
      name: name.trim(),
      description: description?.trim() || "",
      code: classCode,
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
      join_code: classCode,
    });
  } catch (error) {
    console.error("Error in POST /api/educator/classes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/api/backend-url";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; assignmentId: string }> },
) {
  const { classId, assignmentId } = await params;
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const backendUrl = getBackendUrl();
  const targetUrl = `${backendUrl}/educator/classes/${classId}/assignments/${assignmentId}/generate-teams`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      // Team generation can take several minutes (Gemini + large classes).
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        error:
          "Team generation service is unavailable. Start the backend with: cd backend && uvicorn main:app --reload",
      },
      { status: 503 },
    );
  }
}

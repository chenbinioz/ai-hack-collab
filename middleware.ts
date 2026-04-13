import { type NextRequest } from "next/server";
import { updateStudentAuthSession } from "@/lib/supabase/student-middleware";

export async function middleware(request: NextRequest) {
  return updateStudentAuthSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

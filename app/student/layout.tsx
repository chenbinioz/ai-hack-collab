"use client";

import { RequireStudentAuth } from "@/components/require-student-auth";

export default function StudentSectionLayout({ children }: { children: React.ReactNode }) {
  return <RequireStudentAuth>{children}</RequireStudentAuth>;
}

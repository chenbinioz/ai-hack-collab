"use client";

import { RequireEducatorAuth } from "@/components/require-educator-auth";

export default function EducatorSectionLayout({ children }: { children: React.ReactNode }) {
  return <RequireEducatorAuth>{children}</RequireEducatorAuth>;
}

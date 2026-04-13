"use client";

import { EducatorWorkspaceShell } from "./educator-workspace-shell";

export default function EducatorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <EducatorWorkspaceShell>{children}</EducatorWorkspaceShell>;
}

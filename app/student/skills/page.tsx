import { redirect } from "next/navigation";

export default function SkillsRedirectPage() {
  redirect("/student?tab=skills");
}
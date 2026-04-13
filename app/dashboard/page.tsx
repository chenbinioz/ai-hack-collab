import { redirect } from "next/navigation";

/** Legacy path: student home lives at `/student`. */
export default function DashboardRedirectPage() {
  redirect("/student");
}

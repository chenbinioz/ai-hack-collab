import { redirect } from "next/navigation";

/** Canonical student registration lives at `/signup/student`. */
export default function SignupPage() {
  redirect("/signup/student");
}

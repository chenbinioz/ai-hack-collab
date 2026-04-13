import { redirect } from "next/navigation";

/** Legacy path; educator workspace lives under `/educator/survey-results`. */
export default function EducatorOverviewRedirectPage() {
  redirect("/educator/survey-results");
}

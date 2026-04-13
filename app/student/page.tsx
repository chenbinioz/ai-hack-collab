import type { Metadata } from "next";
import { StudentHomeView } from "./student-home-view";

export const metadata: Metadata = {
  title: "Your space — Cohort Connect",
  description: "Signed-in student home for Cohort Connect.",
};

export default function StudentHomePage() {
  return <StudentHomeView />;
}

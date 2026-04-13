import type { Metadata } from "next";
import { StudentProfileSurveyPage } from "./student-profile-survey-page";

export const metadata: Metadata = {
  title: "Student profile survey — Cohort Connect",
  description: "Complete your one-time student profile survey for Cohort Connect.",
};

export default function StudentProfileSurveyRoutePage() {
  return <StudentProfileSurveyPage />;
}

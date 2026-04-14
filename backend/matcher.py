import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use a valid free model
model = genai.GenerativeModel("gemini-2.5-flash")

def match_students(students):
    # Extract only the relevant survey details from the Supabase records to feed the LLM
    cleaned_students = []
    for s in students:
        cleaned = {
            "id": s.get("id"),
            "name": s.get("survey_name"),
            "degree": s.get("survey_degree_title"),
            "year": s.get("survey_year"),
            "ancillary_module": s.get("survey_ancillary_module"),
            "confidence_scores": {
                "coding": s.get("survey_confidence_coding"),
                "written_reports": s.get("survey_confidence_written_reports"),
                "presentation": s.get("survey_confidence_presentation_public_speaking"),
                "math": s.get("survey_confidence_mathematical_literacy"),
                "abstract_concepts": s.get("survey_confidence_abstract_complex_content"),
                "conflict_resolution": s.get("survey_confidence_conflict_resolution")
            },
            "approach_and_style_scores": {
                "deadlines": s.get("survey_approach_deadline"),
                "discussion": s.get("survey_approach_discussion"),
                "disagreement": s.get("survey_approach_disagreement"),
                "new_concepts": s.get("survey_approach_new_concepts"),
                "communication": s.get("survey_approach_communication"),
                "teamwork": s.get("survey_approach_teammate_work"),
                "heavy_workload": s.get("survey_approach_heavy_workload"),
                "project_role": s.get("survey_approach_group_project_role"),
                "critical_feedback": s.get("survey_approach_critical_feedback")
            }
        }
        cleaned_students.append(cleaned)

    profiles_json = json.dumps(cleaned_students, indent=2)

    prompt = (
        "You are a collaboration coach forming balanced student project groups.\n\n"
        "Student profiles (in JSON):\n"
        f"{profiles_json}\n\n"
        "Form groups of 3-4 with complementary skills and compatible working styles based on these survey scores (scores are 1-5).\n"
        "Return ONLY valid JSON in the exact structure below, without markdown blocks:\n"
        '{"groups": [{"members": ["uuid1", "uuid2"], "reason": "..."}]}'
    )

    try:
        response = model.generate_content(prompt)
        
        # Strip potential markdown formatting that gemini might return
        text = response.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        return parsed
    except Exception as e:
        # Catch quota/rate limit errors or parsing errors gracefully
        return {"error": f"AI Matching failed: {str(e)}"}
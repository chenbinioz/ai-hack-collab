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
    # Extract only essential survey details to reduce prompt size
    cleaned_students = []
    for s in students:
        cleaned = {
            "id": s.get("id"),
            "name": s.get("survey_name", "Unknown"),
            "skills": f"Math:{s.get('survey_confidence_mathematical_literacy', 0)}, Coding:{s.get('survey_confidence_coding', 0)}, Writing:{s.get('survey_confidence_written_reports', 0)}, Presentation:{s.get('survey_confidence_presentation_public_speaking', 0)}",
            "style": f"Deadline:{s.get('survey_approach_deadline', 0)}, Communication:{s.get('survey_approach_communication', 0)}, Conflict:{s.get('survey_confidence_conflict_resolution', 0)}, Teamwork:{s.get('survey_approach_teammate_work', 0)}"
        }
        cleaned_students.append(cleaned)

    profiles_json = json.dumps(cleaned_students, indent=2)

    prompt = (
        "Form 3-4 student groups for project work. Each group should have complementary skills.\n\n"
        "Student data (JSON format with skills and working styles rated 1-5):\n"
        f"{profiles_json}\n\n"
        "Create balanced groups of 3-4 students each. Return ONLY JSON: {\"groups\": [{\"members\": [\"id1\", \"id2\"], \"reason\": \"why this group works\"}]}"
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
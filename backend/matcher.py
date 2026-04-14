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

def get_recent_feedback_patterns():
    """
    Fetch recent feedback patterns from the database to inform AI matching.
    """
    try:
        # Import here to avoid circular imports
        from database import supabase

        if not supabase:
            return None

        # Get feedback from the last 30 days
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()

        response = supabase.table("feedback").select("""
            team_id,
            skill_match,
            style_match,
            overall_satisfaction,
            teams(name)
        """).gte("created_at", thirty_days_ago).execute()

        if not response.data:
            return None

        # Group by team and calculate averages
        team_feedback = {}
        for feedback in response.data:
            team_id = feedback["team_id"]
            team_name = feedback.get("teams", {}).get("name", f"Team {team_id[:8]}")

            if team_id not in team_feedback:
                team_feedback[team_id] = {
                    "name": team_name,
                    "skill_match": [],
                    "style_match": [],
                    "overall": []
                }

            team_feedback[team_id]["skill_match"].append(feedback["skill_match"])
            team_feedback[team_id]["style_match"].append(feedback["style_match"])
            team_feedback[team_id]["overall"].append(feedback["overall_satisfaction"])

        # Build feedback summary
        patterns = []
        for team_id, data in team_feedback.items():
            avg_skill = sum(data["skill_match"]) / len(data["skill_match"])
            avg_style = sum(data["style_match"]) / len(data["style_match"])
            avg_overall = sum(data["overall"]) / len(data["overall"])

            if avg_overall < 3:
                patterns.append(f"- The last time we paired students in '{data['name']}', the satisfaction was {avg_overall:.1f}/5")
            elif avg_skill < 3:
                patterns.append(f"- Students in '{data['name']}' reported low skill match ({avg_skill:.1f}/5)")
            elif avg_style < 3:
                patterns.append(f"- Students in '{data['name']}' reported low style match ({avg_style:.1f}/5)")

        return "\n".join(patterns) if patterns else None

    except Exception as e:
        print(f"Error fetching feedback patterns: {e}")
        return None

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
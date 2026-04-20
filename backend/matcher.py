import os
import json
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load project-root .env regardless of process working directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=True)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Use a valid free model name. Instantiate per request to avoid stale auth state.
MODEL_NAME = "gemini-2.5-flash"

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

def match_students(students, ai_preferences=None):
    """
    Match students into teams using AI, with customizable preferences.
    ai_preferences: dict with keys like focus_skills, focus_working_style, etc.
    """
    if ai_preferences is None:
        ai_preferences = {
            "focus_skills": True,
            "focus_working_style": True,
            "focus_availability": True,
            "focus_goals": True,
            "balance_diversity": True
        }

    active_key = (os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY or "").strip()
    if not active_key:
        return {"error": "AI Matching failed: GEMINI_API_KEY is missing in environment."}
    print(f"Gemini runtime key fingerprint: len={len(active_key)} sha16={hashlib.sha256(active_key.encode()).hexdigest()[:16]}")

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

    # Build dynamic prompt based on preferences
    prompt_parts = ["Form student groups for project work."]

    if ai_preferences.get("focus_skills", True):
        prompt_parts.append("Prioritize complementary skills within each group.")

    if ai_preferences.get("focus_working_style", True):
        prompt_parts.append("Consider working styles and communication preferences.")

    if ai_preferences.get("balance_diversity", True):
        prompt_parts.append("Create diverse groups with different strengths.")

    if ai_preferences.get("focus_availability", True):
        prompt_parts.append("Consider scheduling compatibility.")

    if ai_preferences.get("focus_goals", True):
        prompt_parts.append("Match students with similar project goals.")

    prompt_parts.append(f"\n\nStudent data (JSON format):\n{profiles_json}\n\n")
    prompt_parts.append("Create balanced groups. Return ONLY JSON: {\"groups\": [{\"members\": [\"id1\", \"id2\"], \"reason\": \"why this group works\"}]}")

    prompt = "\n".join(prompt_parts)

    # Keep the prompt compact and deterministic for API reliability.

    try:
        # Use Gemini HTTP API directly to avoid deprecated SDK runtime inconsistencies.
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={active_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        request = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=60) as resp:
            response_json = json.loads(resp.read().decode("utf-8"))

        candidates = response_json.get("candidates") or []
        if not candidates:
            return {"error": f"AI Matching failed: unexpected Gemini response: {response_json}"}

        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        text = ""
        for part in parts:
            text += part.get("text", "")

        # Strip potential markdown formatting that Gemini might return
        text = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        return parsed
    except urllib.error.HTTPError as e:
        key_suffix = (active_key[-4:] if active_key else "none")
        body = e.read().decode("utf-8", errors="ignore")
        print(f"Gemini HTTP error (key_suffix={key_suffix}, status={e.code}): {body}")
        return {"error": f"AI Matching failed: Gemini HTTP {e.code}: {body}"}
    except urllib.error.URLError as e:
        key_suffix = (active_key[-4:] if active_key else "none")
        print(f"Gemini URL error (key_suffix={key_suffix}): {e}")
        return {"error": f"AI Matching failed: Gemini network error: {e}"}
    except Exception as e:
        # Catch quota/rate limit/invalid key errors or parsing errors gracefully
        key_suffix = (active_key[-4:] if active_key else "none")
        print(f"Gemini generate_content failed (key_suffix={key_suffix}): {e}")
        return {"error": f"AI Matching failed: {str(e)}"}
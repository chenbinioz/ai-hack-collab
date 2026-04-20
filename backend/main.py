import os
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from database import init_db, save_student, get_all_students, get_all_teams, save_teams, reset_matches, supabase
from matcher import match_students

app = FastAPI()

# CORS lets your friend's Next.js app (on a different address)
# talk to this backend. Without this the browser blocks all
# requests from other origins as a security measure.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Set up the database when the app starts
init_db()

# Root endpoint
@app.get("/")
def root():
    return {"message": "API is running"}

# Defines exactly what data the frontend must send
# when submitting a student profile. FastAPI automatically
# checks incoming data matches this shape.
class Student(BaseModel):
    name: str
    skills: str
    working_style: str
    availability: str
    goals: str

# ENDPOINT 1: Save a new student profile
# Call: POST /students  with a JSON body matching Student above
@app.post("/students")
def add_student(student: Student):
    save_student(student.dict())
    return {"message": "Profile saved!"}

# ENDPOINT 2: Get all student profiles
# Call: GET /students
@app.get("/students")
def list_students():
    return get_all_students()

# ENDPOINT 3: Run the AI matching
# Call: POST /match  — loads all profiles, sends to Gemini, returns groups
@app.post("/match")
def match():
    students = get_all_students()
    if len(students) < 2:
        return {"error": "Need at least 2 students to match"}
        
    matches = match_students(students)
    
    # Check if the Gemini API request failed (e.g., rate limits)
    if isinstance(matches, dict) and "error" in matches:
        return matches
    
    # Save the generated teams to Supabase and assign students
    save_teams(matches)
    
    return {"matches": matches}

# ENDPOINT 5: Get teams and students for educators
# Call: GET /educator-data
@app.get("/educator-data")
def get_educator_data():
    # Get all teams
    teams = get_all_teams()
    
    # Get all students with completed surveys
    students = get_all_students()
    
    # Transform students to include only needed fields
    transformed_students = []
    for student in students:
        transformed_students.append({
            "id": student.get("id"),
            "survey_name": student.get("survey_name"),
            "team_id": student.get("team_id")
        })
    
    return {
        "teams": teams,
        "students": transformed_students
    }

# ENDPOINT 6: Reset all team assignments
# Call: POST /reset-matches
@app.post("/reset-matches")
def reset_matches_endpoint():
    try:
        reset_matches()
        return {"message": "All team assignments have been reset successfully"}
    except Exception as e:
        print(f"Error resetting matches: {e}")
        return {"error": f"Failed to reset matches: {str(e)}"}

# ENDPOINT 7: Get messages for user's team
# Call: GET /messages
@app.get("/messages")
def get_messages(request: Request):
    """
    Returns all messages for the current user's team.
    """
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")

        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        user_id = str(user_response.user.id)

        user_profile = supabase.table("student_profiles").select("team_id").eq("id", user_id).execute()
        if not user_profile.data or not user_profile.data[0].get("team_id"):
            return {"messages": []}

        team_id = user_profile.data[0]["team_id"]

        messages_response = supabase.table("messages").select("id,team_id,sender_id,content,created_at").eq("team_id", team_id).order("created_at", desc=False).execute()

        message_rows = messages_response.data or []
        sender_ids = list({m["sender_id"] for m in message_rows})

        profile_response = []
        if sender_ids:
            profile_response = supabase.table("student_profiles").select("id,survey_name").in_("id", sender_ids).execute().data or []

        sender_names = {row["id"]: row.get("survey_name") or "Unknown" for row in profile_response}

        formatted_messages = [
            {
                "id": msg["id"],
                "team_id": msg["team_id"],
                "sender_id": msg["sender_id"],
                "sender_name": sender_names.get(msg["sender_id"], "Unknown"),
                "content": msg["content"],
                "created_at": msg["created_at"]
            }
            for msg in message_rows
        ]

        return {"messages": formatted_messages}

    except Exception as e:
        print(f"Error fetching messages: {e}")
        return {"error": f"Failed to fetch messages: {str(e)}"}

# ENDPOINT 8: Send a message to user's team
# Call: POST /messages with JSON body {"content": "message text"}
@app.post("/messages")
def send_message(request: Request, message: dict):
    """
    Sends a message to the current user's team.
    """
    if not supabase:
        return {"error": "Database not configured"}

    try:
        content = message.get("content", "").strip()
        if not content:
            return {"error": "Message content cannot be empty"}

        if len(content) > 1000:
            return {"error": "Message too long (max 1000 characters)"}

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")

        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        user_id = str(user_response.user.id)

        user_profile = supabase.table("student_profiles").select("team_id").eq("id", user_id).execute()
        if not user_profile.data or not user_profile.data[0].get("team_id"):
            return {"error": "User not assigned to a team"}

        team_id = user_profile.data[0]["team_id"]

        message_data = {
            "team_id": team_id,
            "sender_id": user_id,
            "content": content
        }

        result = supabase.table("messages").insert(message_data).execute()

        if result.data:
            return {"message": "Message sent successfully", "id": result.data[0]["id"]}
        else:
            return {"error": "Failed to send message"}

    except Exception as e:
        print(f"Error sending message: {e}")
        return {"error": f"Failed to send message: {str(e)}"}

# ============================================================================
# CLASS MANAGEMENT ENDPOINTS
# ============================================================================

class ClassCreateRequest(BaseModel):
    name: str
    description: str = ""
    coursework_deadline: Optional[str] = None
    max_team_size: int = 3
    ai_preferences: dict = {
        "focus_skills": True,
        "focus_working_style": True,
        "focus_availability": True,
        "focus_goals": True,
        "balance_diversity": True
    }

class JoinClassRequest(BaseModel):
    code: str

# ENDPOINT 9: Create a new class (Educator only)
# Call: POST /educator/classes with JSON body
@app.post("/educator/classes")
def create_class(request: Request, class_data: ClassCreateRequest):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")
        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        educator_id = str(user_response.user.id)

        # Generate unique class code
        code_result = supabase.rpc("generate_class_code").execute()
        class_code = code_result.data

        class_insert = {
            "educator_id": educator_id,
            "name": class_data.name,
            "description": class_data.description,
            "coursework_deadline": class_data.coursework_deadline,
            "code": class_code,
            "max_team_size": class_data.max_team_size,
            "ai_preferences": class_data.ai_preferences
        }

        result = supabase.table("classes").insert(class_insert).execute()

        if result.data:
            return {
                "success": True,
                "class": result.data[0],
                "join_code": class_code
            }
        else:
            return {"error": "Failed to create class"}

    except Exception as e:
        print(f"Error creating class: {e}")
        return {"error": f"Failed to create class: {str(e)}"}

# ENDPOINT 10: Get educator's classes
# Call: GET /educator/classes
@app.get("/educator/classes")
def get_educator_classes(request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")
        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        educator_id = str(user_response.user.id)

        # Get classes
        classes_result = supabase.table("classes").select("*").eq("educator_id", educator_id).order("created_at", desc=True).execute()

        classes = classes_result.data or []

        # Get enrollment counts for each class
        for class_item in classes:
            enrollment_count = supabase.table("class_enrollments").select("id", count=True).eq("class_id", class_item["id"]).execute()
            class_item["student_count"] = len(enrollment_count.data) if enrollment_count.data else 0

        return {"classes": classes}

    except Exception as e:
        print(f"Error fetching classes: {e}")
        return {"error": f"Failed to fetch classes: {str(e)}"}

# ENDPOINT 11: Get class details with enrolled students
# Call: GET /educator/classes/{class_id}
@app.get("/educator/classes/{class_id}")
def get_class_details(class_id: str, request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")
        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        educator_id = str(user_response.user.id)

        # Verify educator owns this class
        class_result = supabase.table("classes").select("*").eq("id", class_id).eq("educator_id", educator_id).execute()

        if not class_result.data:
            return {"error": "Class not found or access denied"}

        class_data = class_result.data[0]

        # Get enrolled students
        enrollments = supabase.table("class_enrollments").select("""
            id,
            enrolled_at,
            role,
            student_profiles!inner(id, survey_name, profile_survey_completed_at)
        """).eq("class_id", class_id).execute()

        students = []
        if enrollments.data:
            for enrollment in enrollments.data:
                student = enrollment["student_profiles"]
                students.append({
                    "id": student["id"],
                    "name": student.get("survey_name") or "Unnamed Student",
                    "enrolled_at": enrollment["enrolled_at"],
                    "role": enrollment["role"],
                    "survey_completed": student.get("profile_survey_completed_at") is not None
                })

        # Get teams for this class
        teams_result = supabase.table("teams").select("*").eq("class_id", class_id).execute()
        teams = teams_result.data or []

        return {
            "class": class_data,
            "students": students,
            "teams": teams
        }

    except Exception as e:
        print(f"Error fetching class details: {e}")
        return {"error": f"Failed to fetch class details: {str(e)}"}

# ENDPOINT 12: Student joins a class by code
# Call: POST /student/join-class with JSON body {"code": "ABC123"}
@app.post("/student/join-class")
def join_class(request: Request, join_data: JoinClassRequest):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")
        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        student_id = str(user_response.user.id)

        # Use RPC function to join class
        result = supabase.rpc("join_class_by_code", {"p_code": join_data.code.upper()}).execute()

        if result.data and result.data.get("success"):
            return {
                "success": True,
                "message": "Successfully joined class",
                "class_id": result.data.get("class_id")
            }
        else:
            return {"error": result.data.get("error", "Failed to join class")}

    except Exception as e:
        print(f"Error joining class: {e}")
        return {"error": f"Failed to join class: {str(e)}"}

# ENDPOINT 13: Get student's enrolled classes
# Call: GET /student/classes
@app.get("/student/classes")
def get_student_classes(request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")
        temp_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        )

        user_response = temp_supabase.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        student_id = str(user_response.user.id)

        # Get enrolled classes with class details
        enrollments = supabase.table("class_enrollments").select("""
            id,
            enrolled_at,
            role,
            classes!inner(id, name, description, code, educator_id, max_team_size, ai_preferences)
        """).eq("student_id", student_id).execute()

        classes = []
        if enrollments.data:
            for enrollment in enrollments.data:
                class_data = enrollment["classes"]
                classes.append({
                    "id": class_data["id"],
                    "name": class_data["name"],
                    "description": class_data["description"],
                    "code": class_data["code"],
                    "enrolled_at": enrollment["enrolled_at"],
                    "role": enrollment["role"],
                    "max_team_size": class_data["max_team_size"],
                    "ai_preferences": class_data["ai_preferences"]
                })

        return {"classes": classes}

    except Exception as e:
        print(f"Error fetching student classes: {e}")
        return {"error": f"Failed to fetch classes: {str(e)}"}

# ENDPOINT 14: Generate teams for a specific class
# Call: POST /educator/classes/{class_id}/generate-teams
@app.post("/educator/classes/{class_id}/generate-teams")
def generate_class_teams(class_id: str, request: Request):
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        anon_key = os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url:
            return {"error": "Database not configured: SUPABASE_URL is missing"}

        if not service_role_key:
            return {"error": "Backend misconfigured: SUPABASE_SERVICE_ROLE_KEY is required to generate teams"}

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"error": "Not authenticated"}

        token = auth_header.replace("Bearer ", "")

        # Use anon (or service key fallback) only for token validation.
        auth_client = create_client(supabase_url, anon_key or service_role_key)
        admin_supabase = create_client(supabase_url, service_role_key)

        user_response = auth_client.auth.get_user(token)
        if not user_response.user:
            return {"error": "Invalid token"}

        educator_id = str(user_response.user.id)

        # Verify educator owns this class
        class_result = admin_supabase.table("classes").select("*").eq("id", class_id).eq("educator_id", educator_id).execute()

        if not class_result.data:
            return {"error": "Class not found or access denied"}

        class_data = class_result.data[0]

        # Get enrolled students who have completed surveys
        enrolled_students = admin_supabase.table("class_enrollments").select("""
            student_id,
            student_profiles!inner(
                id,
                survey_name,
                profile_survey_completed_at,
                survey_confidence_coding,
                survey_confidence_written_reports,
                survey_confidence_presentation_public_speaking,
                survey_confidence_mathematical_literacy,
                survey_confidence_conflict_resolution,
                survey_approach_deadline,
                survey_approach_communication,
                survey_approach_teammate_work
            )
        """).eq("class_id", class_id).execute()

        if not enrolled_students.data:
            return {"error": "No students enrolled in this class"}

        # Filter to only students with completed surveys
        valid_students = []
        for enrollment in enrolled_students.data:
            student = enrollment["student_profiles"]
            if student.get("profile_survey_completed_at"):
                valid_students.append({
                    "id": student["id"],
                    "survey_name": student.get("survey_name"),
                    "survey_confidence_coding": student.get("survey_confidence_coding"),
                    "survey_confidence_written_reports": student.get("survey_confidence_written_reports"),
                    "survey_confidence_presentation_public_speaking": student.get("survey_confidence_presentation_public_speaking"),
                    "survey_confidence_mathematical_literacy": student.get("survey_confidence_mathematical_literacy"),
                    "survey_confidence_conflict_resolution": student.get("survey_confidence_conflict_resolution"),
                    "survey_approach_deadline": student.get("survey_approach_deadline"),
                    "survey_approach_communication": student.get("survey_approach_communication"),
                    "survey_approach_teammate_work": student.get("survey_approach_teammate_work")
                })

        if len(valid_students) < 2:
            return {"error": "Need at least 2 students with completed surveys to generate teams"}

        # Generate teams using AI with class-specific preferences
        matches = match_students(valid_students, class_data.get("ai_preferences", {}))

        if isinstance(matches, dict) and "error" in matches:
            return matches

        # Regeneration should replace existing class teams, not append more.
        existing_teams_result = admin_supabase.table("teams").select("id").eq("class_id", class_id).execute()
        existing_team_ids = [team["id"] for team in (existing_teams_result.data or []) if team.get("id")]

        if existing_team_ids:
            # Remove old team assignments for students currently linked to this class's teams.
            admin_supabase.table("student_profiles").update({"team_id": None}).in_("team_id", existing_team_ids).execute()
            # Delete old teams for this class (messages/feedback cascade via FK).
            admin_supabase.table("teams").delete().eq("class_id", class_id).execute()

        # Save teams with class_id
        if "groups" in matches:
            for group in matches["groups"]:
                group["class_id"] = class_id

        save_teams(matches, class_id)

        return {"matches": matches, "class_id": class_id}

    except Exception as e:
        print(f"Error generating teams: {e}")
        return {"error": f"Failed to generate teams: {str(e)}"}

# NOTE: get_current_user helper is unused after this messaging fix.

def get_all_teams():
    """
    Fetches all teams from the Supabase `teams` table.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return []
    
    try:
        response = supabase.table("teams").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"Supabase Teams Error: {e}")
        return []

import os
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from database import init_db, save_student, get_all_students, get_all_teams, save_teams, reset_matches, supabase, compute_collaboration_balance_for_teams
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

    # Compute collaboration balance (Gini) per team and attach to team objects
    try:
        team_ids = [t.get("id") for t in teams if t.get("id")]
        collab_map = compute_collaboration_balance_for_teams(team_ids) if team_ids else {}
        for t in teams:
            tid = t.get("id")
            if not tid:
                t["collaboration_balance"] = None
            else:
                t["collaboration_balance"] = collab_map.get(tid, 0.0)
    except Exception as e:
        print(f"Warning: failed to compute collaboration balance: {e}")
    
    # Compute collaboration balance (Gini) per team using message counts
    try:
        team_ids = [t.get("id") for t in teams if t.get("id")]
        balances = compute_collaboration_balance_for_teams(team_ids)
        # Attach to team objects
        for t in teams:
            tid = t.get("id")
            if tid and tid in balances:
                t["collaboration_balance"] = balances.get(tid, 0.0)
            else:
                t["collaboration_balance"] = 0.0
    except Exception as e:
        print(f"Error computing collaboration balances: {e}")

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

class AssignmentCreateRequest(BaseModel):
    title: str
    description: str = ""
    due_date: Optional[str] = None
    max_team_size: int = 3
    ai_preferences: dict = {
        "focus_skills": True,
        "focus_working_style": True,
        "focus_availability": True,
        "balance_diversity": True
    }
    sort_order: int = 0

class AssignmentUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    max_team_size: Optional[int] = None
    ai_preferences: Optional[dict] = None
    sort_order: Optional[int] = None

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
            "code": class_code,
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
            classes!inner(id, name, description, code, educator_id)
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
                })

        return {"classes": classes}

    except Exception as e:
        print(f"Error fetching student classes: {e}")
        return {"error": f"Failed to fetch classes: {str(e)}"}

# ============================================================================
# ASSIGNMENT ENDPOINTS
# ============================================================================

def _get_authenticated_user_id(request: Request):
    """Returns (user_id, error_response) — error_response is set on failure."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, {"error": "Not authenticated"}

    token = auth_header.replace("Bearer ", "")
    temp_supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    )

    user_response = temp_supabase.auth.get_user(token)
    if not user_response.user:
        return None, {"error": "Invalid token"}

    return str(user_response.user.id), None


def _verify_educator_owns_class(educator_id: str, class_id: str):
    """Returns (class_data, error_response) — error_response is set on failure."""
    class_result = supabase.table("classes").select("*").eq("id", class_id).eq("educator_id", educator_id).execute()
    if not class_result.data:
        return None, {"error": "Class not found or access denied"}
    return class_result.data[0], None


def _verify_assignment_in_class(class_id: str, assignment_id: str):
    """Returns (assignment_data, error_response) — error_response is set on failure."""
    assignment_result = supabase.table("assignments").select("*").eq("id", assignment_id).eq("class_id", class_id).execute()
    if not assignment_result.data:
        return None, {"error": "Assignment not found"}
    return assignment_result.data[0], None


def _collect_valid_students_for_matching(admin_supabase, class_id: str):
    """Returns (valid_students, error_response) for AI team generation."""
    enrolled_students = admin_supabase.table("class_enrollments").select("""
        student_id,
        student_profiles!inner(
            id,
            survey_name,
            profile_survey_completed_at,
            survey_alevel_or_equivalent_titles,
            survey_ancillary_module,
            survey_confidence_coding,
            survey_confidence_written_reports,
            survey_confidence_presentation_public_speaking,
            survey_confidence_mathematical_literacy,
            survey_confidence_abstract_complex_content,
            survey_confidence_conflict_resolution,
            survey_approach_deadline,
            survey_approach_discussion,
            survey_approach_disagreement,
            survey_approach_new_concepts,
            survey_approach_communication,
            survey_approach_teammate_work,
            survey_approach_heavy_workload,
            survey_approach_group_project_role,
            survey_approach_critical_feedback
        )
    """).eq("class_id", class_id).execute()

    if not enrolled_students.data:
        return None, {"error": "No students enrolled in this class"}

    valid_students = []
    for enrollment in enrolled_students.data:
        student = enrollment["student_profiles"]
        if student.get("profile_survey_completed_at"):
            valid_students.append({
                "id": student["id"],
                "survey_name": student.get("survey_name"),
                "survey_alevel_or_equivalent_titles": student.get("survey_alevel_or_equivalent_titles"),
                "survey_ancillary_module": student.get("survey_ancillary_module"),
                "survey_confidence_coding": student.get("survey_confidence_coding"),
                "survey_confidence_written_reports": student.get("survey_confidence_written_reports"),
                "survey_confidence_presentation_public_speaking": student.get("survey_confidence_presentation_public_speaking"),
                "survey_confidence_mathematical_literacy": student.get("survey_confidence_mathematical_literacy"),
                "survey_confidence_abstract_complex_content": student.get("survey_confidence_abstract_complex_content"),
                "survey_confidence_conflict_resolution": student.get("survey_confidence_conflict_resolution"),
                "survey_approach_deadline": student.get("survey_approach_deadline"),
                "survey_approach_discussion": student.get("survey_approach_discussion"),
                "survey_approach_disagreement": student.get("survey_approach_disagreement"),
                "survey_approach_new_concepts": student.get("survey_approach_new_concepts"),
                "survey_approach_communication": student.get("survey_approach_communication"),
                "survey_approach_teammate_work": student.get("survey_approach_teammate_work"),
                "survey_approach_heavy_workload": student.get("survey_approach_heavy_workload"),
                "survey_approach_group_project_role": student.get("survey_approach_group_project_role"),
                "survey_approach_critical_feedback": student.get("survey_approach_critical_feedback"),
            })

    if len(valid_students) < 2:
        return None, {"error": "Need at least 2 students with completed surveys to generate teams"}

    required_fields = [
        "survey_alevel_or_equivalent_titles",
        "survey_ancillary_module",
        "survey_confidence_coding",
        "survey_confidence_written_reports",
        "survey_confidence_presentation_public_speaking",
        "survey_confidence_mathematical_literacy",
        "survey_confidence_abstract_complex_content",
        "survey_confidence_conflict_resolution",
        "survey_approach_deadline",
        "survey_approach_discussion",
        "survey_approach_disagreement",
        "survey_approach_new_concepts",
        "survey_approach_communication",
        "survey_approach_teammate_work",
        "survey_approach_heavy_workload",
        "survey_approach_group_project_role",
        "survey_approach_critical_feedback",
    ]

    students_missing_fields = []
    for student in valid_students:
        missing = []
        for field_name in required_fields:
            value = student.get(field_name)
            if value is None:
                missing.append(field_name)
                continue

            if field_name == "survey_alevel_or_equivalent_titles":
                if isinstance(value, list) and len(value) == 0:
                    missing.append(field_name)
                elif isinstance(value, str) and not value.strip():
                    missing.append(field_name)

            if isinstance(value, str) and not value.strip():
                missing.append(field_name)

        if missing:
            students_missing_fields.append(
                {
                    "student_id": student.get("id"),
                    "student_name": student.get("survey_name") or "Unnamed student",
                    "missing_fields": sorted(list(set(missing))),
                }
            )

    if students_missing_fields:
        student_names = ", ".join(item["student_name"] for item in students_missing_fields)
        return None, {
            "error": (
                "Cannot run AI matching because some required survey values are missing. "
                "Please ask these students to complete the profile survey again: "
                f"{student_names}."
            ),
            "students_requiring_resurvey": students_missing_fields,
        }

    return valid_students, None


@app.get("/educator/classes/{class_id}/assignments")
def list_class_assignments(class_id: str, request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        _, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        result = supabase.table("assignments").select("*").eq("class_id", class_id).order("sort_order").order("created_at").execute()
        return {"assignments": result.data or []}

    except Exception as e:
        print(f"Error listing assignments: {e}")
        return {"error": f"Failed to list assignments: {str(e)}"}


@app.post("/educator/classes/{class_id}/assignments")
def create_assignment(class_id: str, request: Request, assignment_data: AssignmentCreateRequest):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        _, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        assignment_insert = {
            "class_id": class_id,
            "title": assignment_data.title,
            "description": assignment_data.description,
            "due_date": assignment_data.due_date,
            "max_team_size": assignment_data.max_team_size,
            "ai_preferences": assignment_data.ai_preferences,
            "sort_order": assignment_data.sort_order,
            "created_by": educator_id,
        }

        result = supabase.table("assignments").insert(assignment_insert).execute()

        if result.data:
            return {"success": True, "assignment": result.data[0]}
        return {"error": "Failed to create assignment"}

    except Exception as e:
        print(f"Error creating assignment: {e}")
        return {"error": f"Failed to create assignment: {str(e)}"}


@app.patch("/educator/classes/{class_id}/assignments/{assignment_id}")
def update_assignment(class_id: str, assignment_id: str, request: Request, assignment_data: AssignmentUpdateRequest):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        _, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        _, assignment_error = _verify_assignment_in_class(class_id, assignment_id)
        if assignment_error:
            return assignment_error

        updates = assignment_data.model_dump(exclude_unset=True)
        if not updates:
            return {"error": "No fields to update"}

        result = supabase.table("assignments").update(updates).eq("id", assignment_id).execute()

        if result.data:
            return {"success": True, "assignment": result.data[0]}
        return {"error": "Failed to update assignment"}

    except Exception as e:
        print(f"Error updating assignment: {e}")
        return {"error": f"Failed to update assignment: {str(e)}"}


@app.delete("/educator/classes/{class_id}/assignments/{assignment_id}")
def delete_assignment(class_id: str, assignment_id: str, request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        _, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        _, assignment_error = _verify_assignment_in_class(class_id, assignment_id)
        if assignment_error:
            return assignment_error

        supabase.table("assignments").delete().eq("id", assignment_id).execute()
        return {"success": True, "message": "Assignment deleted"}

    except Exception as e:
        print(f"Error deleting assignment: {e}")
        return {"error": f"Failed to delete assignment: {str(e)}"}


@app.get("/student/classes/{class_id}/assignments")
def get_student_class_assignments(class_id: str, request: Request):
    if not supabase:
        return {"error": "Database not configured"}

    try:
        student_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        enrollment = supabase.table("class_enrollments").select("id").eq("class_id", class_id).eq("student_id", student_id).execute()
        if not enrollment.data:
            return {"error": "Not enrolled in this class"}

        result = supabase.rpc("list_student_assignments", {"p_class_id": class_id}).execute()
        return {"assignments": result.data or []}

    except Exception as e:
        print(f"Error fetching student assignments: {e}")
        return {"error": f"Failed to fetch assignments: {str(e)}"}


# ENDPOINT 14: Generate teams for a specific class (deprecated)
# Call: POST /educator/classes/{class_id}/generate-teams
@app.post("/educator/classes/{class_id}/generate-teams")
def generate_class_teams(class_id: str, request: Request):
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url:
            return {"error": "Database not configured: SUPABASE_URL is missing"}

        if not service_role_key:
            return {"error": "Backend misconfigured: SUPABASE_SERVICE_ROLE_KEY is required to generate teams"}

        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        admin_supabase = create_client(supabase_url, service_role_key)
        _, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        first_assignment = admin_supabase.table("assignments").select("id").eq(
            "class_id", class_id
        ).order("sort_order").order("created_at").limit(1).execute()

        first_assignment_id = first_assignment.data[0]["id"] if first_assignment.data else None
        redirect_endpoint = (
            f"/educator/classes/{class_id}/assignments/{first_assignment_id}/generate-teams"
            if first_assignment_id
            else None
        )

        raise HTTPException(
            status_code=410,
            detail={
                "error": (
                    "Class-level team generation is deprecated. "
                    "Use POST /educator/classes/{class_id}/assignments/{assignment_id}/generate-teams instead."
                ),
                "assignment_id": first_assignment_id,
                "redirect_endpoint": redirect_endpoint,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in deprecated generate teams: {e}")
        return {"error": f"Failed to generate teams: {str(e)}"}


# ENDPOINT 15: Generate teams for a specific assignment
# Call: POST /educator/classes/{class_id}/assignments/{assignment_id}/generate-teams
@app.post("/educator/classes/{class_id}/assignments/{assignment_id}/generate-teams")
def generate_assignment_teams(class_id: str, assignment_id: str, request: Request):
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url:
            return {"error": "Database not configured: SUPABASE_URL is missing"}

        if not service_role_key:
            return {"error": "Backend misconfigured: SUPABASE_SERVICE_ROLE_KEY is required to generate teams"}

        educator_id, auth_error = _get_authenticated_user_id(request)
        if auth_error:
            return auth_error

        admin_supabase = create_client(supabase_url, service_role_key)

        class_data, class_error = _verify_educator_owns_class(educator_id, class_id)
        if class_error:
            return class_error

        assignment_data, assignment_error = _verify_assignment_in_class(class_id, assignment_id)
        if assignment_error:
            return assignment_error

        valid_students, students_error = _collect_valid_students_for_matching(admin_supabase, class_id)
        if students_error:
            return students_error

        assignment_goal_hint = (
            assignment_data.get("description") or assignment_data.get("title") or class_data.get("name") or ""
        ).strip()
        class_context = {
            "coursework_deadline": assignment_data.get("due_date"),
            "project_goal_hint": assignment_goal_hint,
            "max_team_size": assignment_data.get("max_team_size", 3),
        }

        matches = match_students(
            valid_students,
            assignment_data.get("ai_preferences", {}),
            class_context,
        )

        if isinstance(matches, dict) and "error" in matches:
            return matches

        existing_teams_result = admin_supabase.table("teams").select("id").eq(
            "assignment_id", assignment_id
        ).execute()
        existing_team_ids = [
            team["id"] for team in (existing_teams_result.data or []) if team.get("id")
        ]

        if "groups" in matches:
            for group in matches["groups"]:
                group["class_id"] = class_id
                group["assignment_id"] = assignment_id

        created_team_ids = save_teams(
            matches,
            class_id,
            max_team_size=assignment_data.get("max_team_size", 3),
            assignment_id=assignment_id,
        ) or []

        if existing_team_ids:
            stale_team_ids = [tid for tid in existing_team_ids if tid not in created_team_ids]
            if stale_team_ids:
                try:
                    admin_supabase.table("teams").delete().in_("id", stale_team_ids).execute()
                except Exception as del_err:
                    print(f"Warning: Failed to delete old teams: {del_err}")

        return {"matches": matches, "class_id": class_id, "assignment_id": assignment_id}

    except Exception as e:
        print(f"Error generating assignment teams: {e}")
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

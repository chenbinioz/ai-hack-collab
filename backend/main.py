import os

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

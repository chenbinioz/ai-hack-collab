from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import init_db, save_student, get_all_students, save_teams, reset_matches, supabase
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

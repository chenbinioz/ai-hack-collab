import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# Attempt to use service role key if available, otherwise fallback to anon key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("Warning: Missing SUPABASE_URL or SUPABASE_KEY in environment.")
    supabase = None

def init_db():
    # Deprecated: Supabase handles schema via migrations now.
    pass

def save_student(data):
    # Deprecated: Frontend inserts directly via Supabase Auth triggers and RPC.
    pass

def get_all_students():
    """
    Fetches all completed student surveys from the Supabase `student_profiles` table.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return []
    
    try:
        # Fetch profiles where the survey has been completed
        response = supabase.table("student_profiles").select("*").not_.is_("profile_survey_completed_at", "null").execute()
        return response.data
    except Exception as e:
        print(f"Supabase Select Error: {e}")
        return []

def save_teams(matches_parsed, class_id=None):
    """
    Takes parsed JSON containing groups, inserts a new 'teams' record,
    and assigns 'team_id' on the matching member 'student_profiles'.
    Now supports class-scoped teams.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return

    groups = matches_parsed.get("groups", [])
    if not groups:
        return
        
    print(f"Starting to sync {len(groups)} AI-generated teams to Supabase...")
    for idx, group in enumerate(groups, start=1):
        reason = group.get("reason", "")
        members = group.get("members", [])
        group_class_id = group.get("class_id", class_id)  # Use group-specific class_id or fallback to parameter
        
        # Basic validation: ensure we have members and they look like valid UUIDs (36 chars)
        valid_members = [m for m in members if isinstance(m, str) and len(m) == 36]
        
        if not valid_members:
            print(f"Skipping Team {idx}: No valid member UUIDs found.")
            continue

        team_insert = {
            "name": f"Team {idx}",
            "reason": reason
        }

        # Add class_id if provided
        if group_class_id:
            team_insert["class_id"] = group_class_id

        try:
            # 1. Create the team
            team_res = supabase.table("teams").insert(team_insert).execute()

            if not team_res.data:
                print(f"Failed to create Team {idx}")
                continue

            team_id = team_res.data[0]["id"]

            # 2. Update all members of this team in ONE request (Batch Update)
            # This is significantly faster than one-by-one updates
            update_res = supabase.table("student_profiles").update({"team_id": team_id}).in_("id", valid_members).execute()

            print(f"Successfully created Team {idx} and assigned {len(update_res.data)} students.")
            
        except Exception as e:
            print(f"Supabase Error processing Team {idx}: {e}")
    
    print("AI Team sync complete.")

def get_all_teams():
    """
    Fetches all teams from the Supabase 'teams' table.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return []
    
    try:
        response = supabase.table("teams").select("*").execute()
        return response.data or []
    except Exception as e:
        print(f"Supabase Select Error: {e}")
        return []

def reset_matches():
    """
    Clears all team assignments:
    1. Sets team_id to null on all student_profiles rows.
    2. Deletes all rows from the teams table.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return

    try:
        # 1. Null-out team_id on every student profile
        supabase.table("student_profiles").update({"team_id": None}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("Cleared team_id from all student profiles.")

        # 2. Delete all teams — neq trick selects all rows cleanly
        supabase.table("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("Deleted all teams.")
    except Exception as e:
        print(f"Reset Error: {e}")
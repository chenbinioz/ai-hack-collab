#!/usr/bin/env python3
"""
Apply migrations to initialize the team coach system.
Run this once to set up the Coach system user.
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY in environment.")
    exit(1)

# Use service role key for admin operations
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Migration 022: Create Team Coach system user
COACH_USER_ID = "00000000-0000-0000-0000-000000000001"
COACH_EMAIL = "system+coach@cohortconnect.local"

try:
    # Check if coach user already exists
    check_result = supabase.table("student_profiles").select("id").eq("id", COACH_USER_ID).execute()
    
    if check_result.data:
        print(f"✓ Coach user already exists (id: {COACH_USER_ID})")
    else:
        print(f"Creating Coach system user...")
        
        # Create auth user using admin API
        try:
            auth_user = supabase.auth.admin.create_user(
                email=COACH_EMAIL,
                password="coach_system_user_" + COACH_USER_ID,  # Won't be used, just needed for creation
                user_metadata={
                    "system_user": True,
                    "role": "coach"
                }
            )
            print(f"✓ Created auth user for coach")
        except Exception as e:
            # Auth user might already exist, that's OK
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"✓ Coach auth user already exists")
            else:
                print(f"⚠ Could not create auth user: {e}")
                print(f"  Attempting to create profile record anyway...")
        
        # Create coach profile in student_profiles
        coach_data = {
            "id": COACH_USER_ID,
            "survey_name": "Team Coach",
        }
        
        result = supabase.table("student_profiles").insert(coach_data).execute()
        
        if result.data:
            print(f"✓ Created Coach student profile (id: {COACH_USER_ID})")
        else:
            print(f"✗ Failed to create Coach profile")
            exit(1)

    print(f"✓ Team Coach system user ready")

except Exception as e:
    print(f"✗ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

print("\n✓ All migrations applied successfully!")

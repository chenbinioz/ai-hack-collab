#!/usr/bin/env python3
"""
Verify and set up the Team Coach system.
Run this script to ensure the Coach user exists in the database.
"""

import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from team_coach import COACH_USER_ID, COACH_NAME, ensure_coach_user_exists

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

try:
    from supabase import create_client
    
    SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment")
        sys.exit(1)
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print(f"Checking for Coach user (ID: {COACH_USER_ID})...")
    
    # Check if coach user exists
    result = supabase.table("student_profiles").select("id, survey_name").eq("id", COACH_USER_ID).execute()
    
    if result.data:
        print(f"✅ Coach user already exists: {result.data[0]['survey_name']} ({COACH_USER_ID})")
    else:
        print(f"🔧 Coach user not found. Creating...")
        ensure_coach_user_exists(supabase)
        
        # Verify creation
        result = supabase.table("student_profiles").select("id, survey_name").eq("id", COACH_USER_ID).execute()
        if result.data:
            print(f"✅ Coach user created successfully: {result.data[0]['survey_name']}")
        else:
            print(f"❌ Failed to create Coach user")
            sys.exit(1)
    
    # List any coaching messages to verify they're being inserted
    messages_result = supabase.table("messages").select("id, team_id, content").eq("sender_id", COACH_USER_ID).limit(5).execute()
    coaching_msg_count = len(messages_result.data or [])
    
    if coaching_msg_count > 0:
        print(f"\n✅ Found {coaching_msg_count} coaching messages in the system")
        print("\nRecent coaching messages:")
        for msg in messages_result.data[:3]:
            content_preview = msg['content'][:80] + "..." if len(msg['content']) > 80 else msg['content']
            print(f"  - Team {msg['team_id']}: {content_preview}")
    else:
        print(f"\n⚠️  No coaching messages found yet. Teams generated after implementing coaching will have messages.")
    
    print("\n✅ Team Coach system is ready!")
    
except ImportError as e:
    print(f"❌ Error: Could not import required modules: {e}")
    print("Make sure you're running this from the backend directory with dependencies installed")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

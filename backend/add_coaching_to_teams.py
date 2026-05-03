#!/usr/bin/env python3
"""
Retroactively add coaching messages to teams that don't have them yet.
Useful if teams were created before the coaching system was integrated.
"""

import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))

from team_coach import insert_coaching_messages, COACH_USER_ID

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

try:
    from supabase import create_client
    
    SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment")
        sys.exit(1)
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("🔍 Finding teams without coaching messages...")
    
    # Get all teams
    teams_result = supabase.table("teams").select("id, name, class_id").execute()
    teams = teams_result.data or []
    
    print(f"Found {len(teams)} total teams")
    
    # For each team, check if it has coaching messages
    teams_needing_coaching = []
    
    for team in teams:
        team_id = team['id']
        team_name = team['name']
        
        # Check if team has messages from coach
        msg_result = supabase.table("messages").select("id").eq("team_id", team_id).eq("sender_id", COACH_USER_ID).limit(1).execute()
        
        if not msg_result.data or len(msg_result.data) == 0:
            teams_needing_coaching.append(team)
            print(f"  ⚠️  {team_name} (ID: {team_id[:8]}...) - NO coaching messages")
        else:
            print(f"  ✅ {team_name} - has coaching messages")
    
    if not teams_needing_coaching:
        print("\n✅ All teams have coaching messages!")
        sys.exit(0)
    
    print(f"\n🔧 Adding coaching to {len(teams_needing_coaching)} teams...")
    
    for team in teams_needing_coaching:
        team_id = team['id']
        team_name = team['name']
        
        # Get team members
        members_result = supabase.table("student_profiles").select("*").eq("team_id", team_id).execute()
        members = members_result.data or []
        
        if not members:
            print(f"  ⚠️  {team_name} has no members, skipping")
            continue
        
        print(f"  → Adding coaching to {team_name} ({len(members)} members)...")
        insert_coaching_messages(supabase, team_id, team_name, members)
    
    print("\n✅ Coaching messages added successfully!")
    
except ImportError as e:
    print(f"❌ Error: Could not import required modules: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

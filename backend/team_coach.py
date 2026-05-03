"""
Team coaching system that analyzes team composition and generates contextual prompts.
Posts these as messages from the "Coach" system user.
"""

COACH_USER_ID = "00000000-0000-0000-0000-000000000001"
COACH_NAME = "Team Coach"


def ensure_coach_user_exists(supabase):
    """
    Ensure the Coach system user exists in the database.
    Creates both the auth user and student profile if necessary.
    """
    try:
        # Check if coach profile already exists
        check_result = supabase.table("student_profiles").select("id").eq("id", COACH_USER_ID).execute()
        
        if not check_result.data:
            print(f"Creating Coach system user...")
            
            # Try to create auth user first (may fail silently if already exists)
            try:
                auth_user = supabase.auth.admin.create_user(
                    email="system+coach@cohortconnect.local",
                    password="coach_system_user_" + COACH_USER_ID,
                    user_metadata={
                        "system_user": True,
                        "role": "coach"
                    }
                )
                print(f"  Created auth user for coach")
            except Exception as auth_err:
                if "already exists" not in str(auth_err).lower() and "duplicate" not in str(auth_err).lower():
                    print(f"  Note: {auth_err}")
                else:
                    print(f"  Auth user already exists")
            
            # Create coach profile
            coach_data = {
                "id": COACH_USER_ID,
                "survey_name": COACH_NAME,
            }
            supabase.table("student_profiles").insert(coach_data).execute()
            print(f"  Created Coach student profile")
        
        return True
    except Exception as e:
        print(f"Warning: Could not ensure Coach user exists: {e}")
        import traceback
        traceback.print_exc()
        return False
        # Don't fail if we can't create the coach user—try to proceed anyway
        return False


def calculate_team_skill_profile(team_members):
    """
    Analyze combined team skills and identify gaps/strengths.
    
    Args:
        team_members: List of student profile dicts with survey fields
        
    Returns:
        Dict with skill analysis
    """
    if not team_members:
        return {}
    
    skill_fields = [
        "survey_confidence_coding",
        "survey_confidence_written_reports",
        "survey_confidence_presentation_public_speaking",
        "survey_confidence_mathematical_literacy",
        "survey_confidence_abstract_complex_content",
        "survey_confidence_conflict_resolution",
    ]
    
    approach_fields = [
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
    
    # Calculate average confidence for each skill
    skill_averages = {}
    for field in skill_fields:
        values = [m.get(field) for m in team_members if m.get(field) is not None]
        if values:
            skill_averages[field] = sum(values) / len(values)
    
    # Calculate average for approach fields
    approach_averages = {}
    for field in approach_fields:
        values = [m.get(field) for m in team_members if m.get(field) is not None]
        if values:
            approach_averages[field] = sum(values) / len(values)
    
    # Identify lowest skill (biggest gap)
    lowest_skill = min(skill_averages.items(), key=lambda x: x[1]) if skill_averages else None
    
    # Identify diversity/conflict indicators
    has_low_conflict_resolution = any(
        m.get("survey_confidence_conflict_resolution", 0) < 3 
        for m in team_members
    )
    
    has_diverse_disagreement_approaches = (
        approach_averages.get("survey_approach_disagreement") 
        and approach_averages["survey_approach_disagreement"] >= 2.5
    )
    
    return {
        "team_size": len(team_members),
        "skill_averages": skill_averages,
        "approach_averages": approach_averages,
        "lowest_skill": lowest_skill,
        "has_low_conflict_resolution": has_low_conflict_resolution,
        "has_diverse_disagreement_approaches": has_diverse_disagreement_approaches,
    }


def generate_coaching_messages(team_members, team_name):
    """
    Generate coaching prompts for a team based on collective skill profile.
    
    Args:
        team_members: List of student profile dicts
        team_name: Name of the team
        
    Returns:
        List of coaching message strings
    """
    profile = calculate_team_skill_profile(team_members)
    messages = []
    
    if not profile:
        return ["Welcome to your team! Work together to deliver great outcomes."]
    
    # Greeting
    messages.append(
        f"Hey {team_name}! 👋 I'm your team coach. I'm here to help you work together effectively. "
        f"I've analyzed your skills and working styles, and I have some suggestions."
    )
    
    # Skill gap coaching
    if profile["lowest_skill"]:
        skill_name, avg_score = profile["lowest_skill"]
        
        skill_labels = {
            "survey_confidence_coding": "coding",
            "survey_confidence_written_reports": "writing reports",
            "survey_confidence_presentation_public_speaking": "public speaking",
            "survey_confidence_mathematical_literacy": "quantitative analysis",
            "survey_confidence_abstract_complex_content": "handling complex concepts",
            "survey_confidence_conflict_resolution": "conflict resolution",
        }
        
        skill_label = skill_labels.get(skill_name, skill_name)
        
        messages.append(
            f"📌 **Skill gap: {skill_label.title()}**\n"
            f"Your team has some space to grow in {skill_label}. Here's how to handle it:\n"
            f"• Pair people: One person leads the initial attempt, another reviews and explains.\n"
            f"• Build in checkpoints: Create moments to sanity-check your work before it's final.\n"
            f"• Document as you go: Write down reasoning so the next person can follow the logic."
        )
    
    # Conflict approach coaching
    if profile["has_diverse_disagreement_approaches"]:
        messages.append(
            f"💬 **Diverse disagreement styles**\n"
            f"Your team has different ways of handling disagreements. That's normal! Here's how to make it work:\n"
            f"• Use a structured check-in when tensions rise: issue → impact → request → next step.\n"
            f"• Rotate the facilitator role so everyone feels heard.\n"
            f"• Remember: disagreeing on ideas ≠ disagreeing about people."
        )
    
    if profile["has_low_conflict_resolution"]:
        messages.append(
            f"🤝 **Supporting conflict skills**\n"
            f"Some team members are building their conflict resolution skills. Help them feel safe:\n"
            f"• Assume good intent in disagreements.\n"
            f"• Ask clarifying questions instead of jumping to conclusions.\n"
            f"• Celebrate when you resolve a tension—it builds confidence."
        )
    
    # Working style insights
    approach = profile.get("approach_averages", {})
    if approach.get("survey_approach_deadline", 0) < 3:
        messages.append(
            f"⏰ **Early planning culture**\n"
            f"Your team tends to prefer starting early and spacing work out. Use this strength:\n"
            f"• Set milestone dates now—don't wait for the last sprint.\n"
            f"• Use 'rolling checkpoints' so everyone sees progress without cramming."
        )
    
    if approach.get("survey_approach_communication", 0) < 3:
        messages.append(
            f"📞 **Frequent communication rhythm**\n"
            f"Your team wants regular check-ins. Build this into your rhythm:\n"
            f"• Schedule standup meetings 2–3 times per week.\n"
            f"• Keep a shared Slack/Discord channel for quick updates.\n"
            f"• Use async updates to respect people's time."
        )
    
    # Closing encouragement
    messages.append(
        f"🎯 **Your team's task**\n"
        f"Agree on a working rhythm in your first meeting: When do we sync? How do we handle problems? "
        f"Get this right, and the rest flows naturally. Good luck! 💪"
    )
    
    return messages


def insert_coaching_messages(supabase, team_id, team_name, team_members):
    """
    Generate and insert coaching messages for a team.
    
    Args:
        supabase: Supabase client (must have service role permissions)
        team_id: UUID of the team
        team_name: Name of the team
        team_members: List of student profile dicts for team members
    """
    try:
        # Ensure the coach user exists
        ensure_coach_user_exists(supabase)
        
        coaching_prompts = generate_coaching_messages(team_members, team_name)
        
        for prompt in coaching_prompts:
            message_data = {
                "team_id": str(team_id),
                "sender_id": str(COACH_USER_ID),  # Explicitly convert to string for JSON serialization
                "content": prompt,
            }
            result = supabase.table("messages").insert(message_data).execute()
            if not result.data:
                print(f"Warning: Failed to insert coaching message to team {team_id}")
        
        print(f"✓ Posted {len(coaching_prompts)} coaching messages to {team_name}")
        
    except Exception as e:
        print(f"Error inserting coaching messages for team {team_id}: {e}")
        import traceback
        traceback.print_exc()

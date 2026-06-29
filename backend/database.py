import os
from supabase import create_client, Client
from dotenv import load_dotenv
from team_coach import insert_coaching_messages

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

def save_teams(matches_parsed, class_id=None, ideal_team_size=None, assignment_id=None):
    """
    Takes parsed JSON containing groups, inserts a new 'teams' record,
    and assigns members via team_members (when assignment_id is set) or
    student_profiles.team_id (legacy global matching).
    
    Args:
        matches_parsed: Parsed JSON from AI matcher with groups
        class_id: Optional class ID to scope teams
        ideal_team_size: Optional ideal team size for validation reporting
        assignment_id: Optional assignment ID for per-assignment team membership

    Returns:
        Dict with created_team_ids and optional team_size_report.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return {"created_team_ids": [], "team_size_report": None}

    groups = matches_parsed.get("groups", [])
    factor_weights = matches_parsed.get("factor_weights", {})
    if not groups:
        return {"created_team_ids": [], "team_size_report": None}
        
    print(f"Starting to sync {len(groups)} AI-generated teams to Supabase...")
    
    team_size_entries = []
    non_ideal_teams = []
    
    created_team_ids = []

    for idx, group in enumerate(groups, start=1):
        reason = group.get("reason", "")
        members = group.get("members", [])
        match_trace = group.get("match_trace", [])
        group_class_id = group.get("class_id", class_id)  # Use group-specific class_id or fallback to parameter
        
        # Basic validation: ensure we have members and they look like valid UUIDs (36 chars)
        valid_members = [m for m in members if isinstance(m, str) and len(m) == 36]
        
        if not valid_members:
            print(f"Skipping Team {idx}: No valid member UUIDs found.")
            continue
        
        team_size = len(valid_members)
        is_ideal = ideal_team_size is None or team_size == ideal_team_size
        team_size_entries.append({
            "team_index": idx,
            "size": team_size,
            "is_ideal": is_ideal,
        })
        if ideal_team_size is not None and not is_ideal:
            non_ideal_teams.append({
                "team_index": idx,
                "size": team_size,
                "delta": team_size - ideal_team_size,
            })
            print(
                f"⚠️  Team {idx} is not ideal size: {team_size} members "
                f"(ideal: {ideal_team_size}) — still creating team"
            )

        team_insert = {
            "name": f"Team {idx}",
            "reason": reason,
            "match_explanation": {
                "factor_weights": factor_weights,
                "match_trace": match_trace,
            },
        }

        # Add class_id if provided
        if group_class_id:
            team_insert["class_id"] = group_class_id

        group_assignment_id = group.get("assignment_id", assignment_id)
        if group_assignment_id:
            team_insert["assignment_id"] = group_assignment_id

        try:
            # 1. Create the team
            team_res = supabase.table("teams").insert(team_insert).execute()

            if not team_res.data:
                print(f"Failed to create Team {idx}")
                continue

            team_id = team_res.data[0]["id"]
            created_team_ids.append(team_id)

            # 2. Assign members
            if group_assignment_id:
                supabase.table("team_members").delete().eq(
                    "assignment_id", group_assignment_id
                ).in_("student_id", valid_members).execute()
                member_rows = [
                    {
                        "student_id": member_id,
                        "team_id": team_id,
                        "assignment_id": group_assignment_id,
                    }
                    for member_id in valid_members
                ]
                insert_res = supabase.table("team_members").insert(member_rows).execute()
                assigned_count = len(insert_res.data or [])
            else:
                update_res = supabase.table("student_profiles").update(
                    {"team_id": team_id}
                ).in_("id", valid_members).execute()
                assigned_count = len(update_res.data or [])

            print(f"Successfully created Team {idx} and assigned {assigned_count} students.")
            
            # 3. Generate and insert coaching messages for the team
            try:
                # Fetch full profiles for team members (for skill analysis)
                member_profiles_res = supabase.table("student_profiles").select("*").in_("id", valid_members).execute()
                if member_profiles_res.data:
                    team_name = team_insert.get("name", f"Team {idx}")
                    print(f"  → Generating coaching for {team_name} ({len(member_profiles_res.data)} members)...")
                    insert_coaching_messages(supabase, team_id, team_name, member_profiles_res.data)
                else:
                    print(f"  ⚠️  Could not fetch profiles for team {idx}")
            except Exception as coach_err:
                print(f"❌ Error generating coaching for Team {idx}: {coach_err}")
                import traceback
                traceback.print_exc()
            
        except Exception as e:
            print(f"Supabase Error processing Team {idx}: {e}")
    
    # Report any non-ideal team sizes
    team_size_report = None
    if ideal_team_size is not None and team_size_entries:
        team_size_report = {
            "ideal_team_size": ideal_team_size,
            "all_ideal": len(non_ideal_teams) == 0,
            "teams": team_size_entries,
            "non_ideal_teams": non_ideal_teams,
        }
        if non_ideal_teams:
            print(f"\n⚠️  NON-IDEAL TEAM SIZES DETECTED ({len(non_ideal_teams)} teams):")
            for entry in non_ideal_teams:
                print(
                    f"  - Team {entry['team_index']}: {entry['size']} members "
                    f"(ideal: {ideal_team_size}, delta: {entry['delta']:+d})"
                )
            print("  → Consider regenerating teams with the ideal size properly applied\n")
        else:
            print(f"\n✓ All {len(team_size_entries)} teams match ideal size ({ideal_team_size})\n")
    
    print("AI Team sync complete.")
    return {
        "created_team_ids": created_team_ids,
        "team_size_report": team_size_report,
    }

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


def compute_gini_from_counts(counts: list) -> float:
    """
    Compute the Gini coefficient for a list of non-negative counts.
    Returns a float between 0 and 1. If all counts are zero or list empty, returns 0.
    """
    if not counts:
        return 0.0
    # Ensure floats
    vals = [float(x) for x in counts]
    n = len(vals)
    if n == 0:
        return 0.0
    mean = sum(vals) / n
    if mean == 0:
        return 0.0
    # Double sum of absolute differences
    total_diff = 0.0
    for i in range(n):
        for j in range(n):
            total_diff += abs(vals[i] - vals[j])
    gini = total_diff / (2 * (n ** 2) * mean)
    # Clamp
    return max(0.0, min(1.0, gini))


def get_team_message_counts(team_ids: list) -> dict:
    """
    For each team_id in team_ids, return a mapping team_id -> {sender_id: count}
    Uses the `messages` table in Supabase.
    """
    result = {}
    if not supabase or not team_ids:
        return result
    try:
        # Fetch counts grouped by team_id and sender_id via a simple select
        # We pull messages for these teams and aggregate in Python to avoid complex RPCs.
        resp = supabase.table("messages").select("team_id, sender_id").in_("team_id", team_ids).execute()
        rows = resp.data or []
        for r in rows:
            tid = r.get("team_id")
            sid = r.get("sender_id")
            if not tid or not sid:
                continue
            team_map = result.get(tid) or {}
            team_map[sid] = team_map.get(sid, 0) + 1
            result[tid] = team_map
    except Exception as e:
        print(f"Error fetching message counts: {e}")
    return result


def compute_collaboration_balance_for_teams(team_ids: list) -> dict:
    """
    Returns a mapping team_id -> gini_coefficient (float 0..1)
    """
    balances = {}
    if not team_ids:
        return balances
    counts_map = get_team_message_counts(team_ids)
    for tid in team_ids:
        sender_counts = counts_map.get(tid, {})
        counts = list(sender_counts.values())
        # If there are no messages, treat as balanced (0)
        gini = compute_gini_from_counts(counts) if counts else 0.0
        balances[tid] = gini
    return balances

def reset_assignment_teams(assignment_id):
    """
    Deletes all teams for a specific assignment.
    team_members rows are removed via ON DELETE CASCADE.
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return

    try:
        supabase.table("teams").delete().eq("assignment_id", assignment_id).execute()
        print(f"Deleted all teams for assignment {assignment_id}.")
    except Exception as e:
        print(f"Reset assignment teams error: {e}")


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


def compute_gini_from_counts(counts: list) -> float:
    """
    Compute Gini coefficient for a list of non-negative counts.
    Returns 0.0 for empty or all-zero lists.

    Uses the efficient formula:
      G = (2 * sum_{i=1..n} i * x_i) / (n * sum_x) - (n + 1) / n
    where x_i are sorted in non-decreasing order.
    """
    try:
        if not counts:
            return 0.0
        n = len(counts)
        total = sum(counts)
        if total <= 0 or n <= 1:
            return 0.0

        sorted_counts = sorted(counts)
        numerator = 0
        for i, x in enumerate(sorted_counts, start=1):
            numerator += i * x

        g = (2 * numerator) / (n * total) - (n + 1) / n
        # Clamp and return as float
        if g < 0:
            return 0.0
        if g > 1:
            return 1.0
        return float(g)
    except Exception as e:
        print(f"Error computing Gini: {e}")
        return 0.0


def compute_collaboration_balance_for_teams(team_ids: list) -> dict:
    """
    For each team_id in `team_ids`, compute the Gini coefficient of message counts
    per sender within that team. Returns a mapping team_id -> gini_float.
    """
    if not supabase:
        return {}
    if not team_ids:
        return {}

    try:
        # Fetch messages for these teams (team_id, sender_id)
        resp = supabase.table("messages").select("team_id,sender_id").in_("team_id", team_ids).execute()
        rows = resp.data or []

        from collections import defaultdict
        team_sender_counts = defaultdict(lambda: defaultdict(int))

        for r in rows:
            tid = r.get("team_id")
            sid = r.get("sender_id")
            if not tid or not sid:
                continue
            team_sender_counts[tid][sid] += 1

        result = {}
        for tid in team_ids:
            sender_map = team_sender_counts.get(tid, {})
            counts = list(sender_map.values())
            # If no messages, treat as perfectly balanced (0.0)
            result[tid] = compute_gini_from_counts(counts) if counts else 0.0

        return result
    except Exception as e:
        print(f"Error computing collaboration balance: {e}")
        return {}
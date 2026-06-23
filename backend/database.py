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

def save_teams(matches_parsed, class_id=None, max_team_size=None):
    """
    Takes parsed JSON containing groups, inserts a new 'teams' record,
    and assigns 'team_id' on the matching member 'student_profiles'.
    Now supports class-scoped teams.
    
    Args:
        matches_parsed: Parsed JSON from AI matcher with groups
        class_id: Optional class ID to scope teams
        max_team_size: Optional max team size constraint for validation
    """
    if not supabase:
        print("Error: Supabase client is not initialized.")
        return

    groups = matches_parsed.get("groups", [])
    factor_weights = matches_parsed.get("factor_weights", {})
    if not groups:
        return
        
    print(f"Starting to sync {len(groups)} AI-generated teams to Supabase...")
    
    # Track violations for warning
    violations = []
    
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
        
        # Check for max team size violation
        if max_team_size and len(valid_members) > max_team_size:
            violations.append({
                "team_index": idx,
                "size": len(valid_members),
                "max_allowed": max_team_size,
                "members": valid_members
            })
            print(f"⚠️  Team {idx} violates max size: {len(valid_members)} members > {max_team_size} max (STILL CREATING - consider regenerating)")

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

        try:
            # 1. Create the team
            team_res = supabase.table("teams").insert(team_insert).execute()

            if not team_res.data:
                print(f"Failed to create Team {idx}")
                continue

            team_id = team_res.data[0]["id"]
            created_team_ids.append(team_id)

            # 2. Update all members of this team in ONE request (Batch Update)
            # This is significantly faster than one-by-one updates
            update_res = supabase.table("student_profiles").update({"team_id": team_id}).in_("id", valid_members).execute()

            print(f"Successfully created Team {idx} and assigned {len(update_res.data)} students.")
            
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
    
    # Report any violations
    if violations:
        print(f"\n⚠️  TEAM SIZE VIOLATIONS DETECTED ({len(violations)} teams):")
        for v in violations:
            print(f"  - Team {v['team_index']}: {v['size']} members (max: {v['max_allowed']})")
        print("  → Consider regenerating teams with the constraint properly applied\n")
    
    print("AI Team sync complete.")
    return created_team_ids

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
# Team Coaching System

## Overview

The team coaching system automatically generates contextual coaching prompts for newly created teams. These appear as messages in the team chat from a "Team Coach" system user, providing guidance on:

- **Skill gaps**: Identifies the team's weakest collective skills and suggests strategies
- **Team dynamics**: Analyzes working style diversity and suggests communication patterns
- **Conflict resolution**: Coaches teams with low conflict resolution skills on handling disagreements
- **Working rhythms**: Recommends meeting frequencies and milestone planning based on team preferences

## Architecture

### Components

1. **`backend/team_coach.py`** - Coaching engine
   - `calculate_team_skill_profile()` - Analyzes collective team skills
   - `generate_coaching_messages()` - Creates personalized coaching prompts
   - `ensure_coach_user_exists()` - Initializes the Coach system user if needed
   - `insert_coaching_messages()` - Posts coaching messages to the team chat

2. **`backend/database.py`** - Integration point
   - Modified `save_teams()` to automatically call coaching after team creation
   - Fetches full member profiles and passes to coaching system

3. **`supabase/migrations/022_team_coach_system.sql`** - Database setup
   - Creates the Coach system user record (id: `00000000-0000-0000-0000-000000000001`)
   - This user is not associated with Supabase Auth; it's purely a system user

4. **`components/team-messaging.tsx`** - Message display
   - Already displays coach messages as part of the team chat
   - Shows `sender_name` from `student_profiles.survey_name` (displays as "Team Coach")

### Data Flow

```
generate_class_teams()
    ↓
match_students() [AI matching]
    ↓
save_teams() in database.py
    ├─ Create teams table row
    ├─ Assign students to team
    └─ Call insert_coaching_messages()
        ├─ ensure_coach_user_exists() [creates Coach if needed]
        ├─ calculate_team_skill_profile()
        ├─ generate_coaching_messages()
        └─ Insert messages into team chat
```

## Coaching Analysis

The system analyzes:

### Skill Confidence Fields
- `survey_confidence_coding`
- `survey_confidence_written_reports`
- `survey_confidence_presentation_public_speaking`
- `survey_confidence_mathematical_literacy`
- `survey_confidence_abstract_complex_content`
- `survey_confidence_conflict_resolution`

### Working Style Fields
- `survey_approach_deadline` - Preference for early vs. last-minute work
- `survey_approach_discussion` - Preference for discussion-driven vs. independent work
- `survey_approach_disagreement` - How team members handle disagreements
- `survey_approach_new_concepts` - Approach to learning new material
- `survey_approach_communication` - Communication preferences
- `survey_approach_teammate_work` - Preferences for how teammates should work
- `survey_approach_heavy_workload` - Handling pressure
- `survey_approach_group_project_role` - Preferred team role
- `survey_approach_critical_feedback` - Response to feedback

## Coaching Messages

Each team receives 5–8 coaching prompts covering:

1. **Welcome & Overview** - Introduction to the Coach
2. **Skill Gap** - Lowest collective skill with concrete strategies
3. **Conflict Approaches** - If team has diverse disagreement styles
4. **Conflict Support** - If some members have low conflict resolution confidence
5. **Deadline Rhythm** - Early planning culture coaching
6. **Communication Cadence** - Meeting frequency recommendations
7. **Closing Encouragement** - Actionable next steps

## Student Experience

### For Students
- Coaching messages appear automatically when a class's teams are first generated
- Messages appear in the team chat under "Team Chat" on the class-specific tab
- Students see the Coach as a "Team Coach" user in the message history
- They can read coaching tips and discuss them with their team

### For Educators
- No changes needed to the team generation flow
- Coaching messages are automatically created during `POST /educator/classes/{class_id}/generate-teams`
- No additional configuration required

## Implementation Notes

### Coach User
- **ID**: `00000000-0000-0000-0000-000000000001` (reserved UUID for system user)
- **Name**: "Team Coach" (displayed in chat)
- **Creation**: Auto-created on first team coaching attempt if not present
- **Permissions**: Posts as service role; students cannot interact with the user account directly

### Message Timing
- Coaching messages are inserted immediately after team creation
- All coaching for a team is inserted as a batch (5–8 messages)
- Students see coaching messages when they first open their team chat
- Messages use the same RLS policies as regular team messages

### Failure Handling
- If coaching message generation fails, team creation still succeeds
- Errors are logged but don't block the team generation endpoint
- Teams can still function without coaching messages (graceful degradation)

## Future Enhancements

1. **Ongoing Coaching** - Generate new coaching prompts based on chat activity (e.g., if conflict is detected)
2. **Adaptive Messaging** - Adjust coaching tone based on team progress milestones
3. **Resource Links** - Embed links to team collaboration resources and templates
4. **Language Models** - Use AI to generate more personalized coaching based on specific team member profiles
5. **Analytics Dashboard** - Track which coaching prompts are most helpful to teams

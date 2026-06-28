# Class Assignments Feature Plan

## Overview

Introduce an `assignments` entity within each class (description, team-generation settings, due date), remove the class-level deadline, scope teams and feedback per assignment, and give educators both per-assignment and aggregated class-level feedback views.

## Current state

Today a class is a single unit of work:

- `classes` holds `coursework_deadline`, `max_team_size`, and `ai_preferences`
- Team generation runs at class level via `POST /educator/classes/{class_id}/generate-teams`
- Students see one team per class tab via global `student_profiles.team_id` — a known limitation for multi-class students
- Feedback is keyed by `(student_id, team_id, class_id)`
- Post-project skill updates gate on `classes.coursework_deadline`

## Target model

Each assignment owns:

- **Description** (`description`)
- **Due date** (`due_date`, replaces class `coursework_deadline`)
- **Team generation settings** (`max_team_size`, `ai_preferences`)
- **Teams** (via `teams.assignment_id`)
- **Feedback** (one submission per student per assignment)
- **Post-project skill update** (unlocks after that assignment's due date)

The class keeps only container metadata: `name`, `code`, `description`, `educator_id`.

## Implementation workstreams

| Workstream | Scope |
|------------|-------|
| Schema | `024_assignments.sql`: assignments table, team_members junction, alter teams/feedback/post_project_skill_updates, backfill, RPC/RLS updates |
| Backend | Assignment CRUD + assignment-scoped generate-teams; refactor `save_teams()` to use team_members |
| Next.js API | Educator/student assignment routes; remove deadline/team fields from class create/update/list |
| Educator UI | Restructure class detail into assignment cards; create-assignment modal; class-level feedback overview |
| Student UI | Assignments list within class tab; scope TeamHub, feedback, countdown, post-project to assignmentId |
| Cleanup | Remove class-level deadline/team-gen UI; deprecate old generate-teams endpoint |

## Rollout

- Existing classes get one auto-created assignment ("Project 1") so no data is lost
- Educators with active classes see their old deadline/teams/feedback under that default assignment
- Team chat continues to work per `team_id`; RLS checks membership via `team_members`
- `student_profiles.team_id` kept temporarily for backward compatibility but no longer written by new team generation

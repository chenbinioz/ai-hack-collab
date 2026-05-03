# Cohort Connect Technical Specifications

## Overview
Cohort Connect is a course-based group formation platform for Imperial STEM. It combines a Next.js frontend, a FastAPI backend, and Supabase Postgres to place students into balanced teams and provide explainable match traces.

## System Architecture
- Frontend: Next.js 16 App Router with React 19
- Backend: FastAPI service in `backend/`
- Database: Supabase PostgreSQL with RLS policies and RPC helpers
- Matching engine: Gemini-powered team formation in `backend/matcher.py`
- Messaging: Team messages and coaching messages stored in Supabase `messages`

## Key Data Flow
1. Student signs in and completes a profile survey.
2. Educator opens a class dashboard and triggers team generation.
3. Backend validates the educator, loads enrolled students, and sends structured student data to the matching engine.
4. The backend saves teams, updates student `team_id` values, and creates coaching messages.
5. The educator dashboard fetches the generated teams and renders the explainable match trace.

## Important Endpoints
- `POST /educator/classes/{class_id}/generate-teams`
- `GET /educator/classes/{class_id}`
- `GET /student/classes`
- `GET /messages`
- `POST /messages`

## Environment Variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_API_URL` optional in development

## Repository Structure
- `app/` frontend routes, dashboards, login, signup, and student flows
- `components/` shared UI pieces
- `backend/` FastAPI app, matching logic, database helpers, and setup scripts
- `supabase/migrations/` database schema and policy migrations
- `public/screenshots/` README screenshots
- `docs/` technical and competition documentation

## Notes
- The educator generate-teams flow requires the Supabase service role key.
- The coach system uses a dedicated sender ID so coaching messages can be posted consistently.
- Match traces intentionally use human-readable labels rather than raw survey keys in the UI.

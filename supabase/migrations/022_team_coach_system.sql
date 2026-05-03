-- Create a system "Coach" user that will post coaching messages to teams.
-- NOTE: The Coach auth user is created by the backend Python code (team_coach.py) 
-- using Supabase admin functions, not here. This migration only sets up the profile
-- record if the auth user already exists.

-- Optionally create the student profile for the coach (backend handles this too)
-- Only insert if auth user exists (assumes backend has already created it)
-- This is a no-op if coach user doesn't exist yet - the backend will create both.

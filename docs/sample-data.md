# Sample Data and Test Cases

## Sample Use Cases

### 1. Student survey completion
- A student signs in, completes the survey, and receives a `student_profiles` row with `profile_survey_completed_at` populated.
- Expected result: the educator dashboard counts the student as survey-complete and includes them during team generation.

### 2. Educator generates teams for a class
- An educator opens a class with at least two survey-complete students and clicks **Generate AI Teams**.
- Expected result: teams are created, students receive a `team_id`, and coaching messages are stored for each generated team.

### 3. Missing required survey fields
- A student has a partial survey record.
- Expected result: the backend returns a clear validation error describing which students need to resubmit the survey.

### 4. Coach messaging
- A generated team is persisted.
- Expected result: coaching messages appear in the `messages` table with the coach sender ID.

## Suggested Manual Checks
- Verify `GET /educator/classes/{class_id}` returns teams and students for the logged-in educator.
- Verify `POST /educator/classes/{class_id}/generate-teams` returns a helpful error if the service role key is missing.
- Verify trace labels in the educator dashboard read as human-friendly phrases rather than raw survey keys.

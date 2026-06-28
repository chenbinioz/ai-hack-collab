# Local branch workflow

This repo is set up for editing on a feature branch and merging back into `main`.

## Current setup

| Item | Value |
|------|-------|
| Local path | `~/Projects/ai-hack-collab` |
| Remote | `https://github.com/chenbinioz/ai-hack-collab.git` |
| Base branch | `main` |
| Working branch | `adam/local-edits` |
| Push access | Direct push to `origin` (verified via dry-run) |

## Daily workflow

1. Confirm you are on the working branch:

   ```bash
   git checkout adam/local-edits
   git pull origin main   # optional: keep in sync with latest main
   ```

2. Make edits, then commit:

   ```bash
   git add <files>
   git commit -m "Describe the change"
   ```

3. Push your branch:

   ```bash
   git push -u origin adam/local-edits
   ```

   On first push, `-u` sets upstream tracking. Later pushes can use `git push` only.

## Recombining into main (recommended: pull request)

1. Push the branch (see above).
2. Open [Pull requests](https://github.com/chenbinioz/ai-hack-collab/pulls) on GitHub.
3. Click **New pull request**.
4. Set **base** to `main` and **compare** to `adam/local-edits`.
5. Add a title and description, request review from teammates if needed, then merge on GitHub.

After merge, update your local `main`:

```bash
git checkout main
git pull origin main
git branch -d adam/local-edits   # delete local branch when done
```

## If push access is denied (fork workflow)

If `git push` returns 403:

1. Fork the repo on GitHub under your account.
2. Repoint remotes:

   ```bash
   git remote rename origin upstream
   git remote add origin https://github.com/<your-username>/ai-hack-collab.git
   git push -u origin adam/local-edits
   ```

3. Open a PR from your fork's `adam/local-edits` → `chenbinioz/ai-hack-collab:main`.

## Local development

- **Frontend:** `npm install` then `npm run dev` (Node v24.x per README).
- **Backend:** `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
- **Env:** copy `.env.example` → `.env` and add Supabase + Gemini keys. Never commit `.env`.
- **Database:** run SQL migrations under `supabase/migrations/` in the Supabase SQL editor.
